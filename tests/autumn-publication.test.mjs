import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { publish, countFiles, digest } from '../scripts/publish-2026-autumn.mjs';
const manifest = JSON.parse(readFileSync(new URL('../scripts/publication-2026-autumn.json', import.meta.url)));
async function example(slug) {
  const entry = manifest.entries.find(entry => entry.slug === slug);
  const source = readFileSync(entry.files[0], 'utf8');
  const code = [...source.matchAll(/```javascript\n([\s\S]*?)```/g)].map(match => match[1]).join('\n');
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

test('schedule has two topics per ISO week with the existing September 30 article; translations retain code, links, and sections', () => {
  const weeks = new Map();
  for (const date of ['2026-09-30', ...manifest.entries.map(e => e.publishedAt.slice(0, 10))]) {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    const key = d.toISOString().slice(0, 10);
    weeks.set(key, (weeks.get(key) ?? 0) + 1);
  }
  assert.equal(manifest.entries.length, 13);
  assert.equal(weeks.size, 7);
  assert.ok([...weeks.values()].every(count => count === 2));
  for (const entry of manifest.entries) {
    const versions = entry.files.map(file => readFileSync(file, 'utf8'));
    const structure = source => ({
      code: [...source.matchAll(/```[^\n]*\n[\s\S]*?```/g)].map(m => m[0]),
      links: [...source.matchAll(/\]\((https?:[^)]+)\)/g)].map(m => m[1]).sort(),
      sections: [...source.matchAll(/^## /gm)].length,
    });
    for (const source of versions) {
      assert.deepEqual(structure(source), structure(versions[0]), entry.slug);
      assert.ok(Number(source.match(/^readingTime: (\d+)/m)[1]) >= 2);
      assert.equal(digest(source), entry.sha256[entry.files[versions.indexOf(source)]]);
    }
  }
});

test('Unicode truncation preserves complete grapheme sequences and rejects invalid limits', async () => {
  const { truncateGraphemes } = await example('unicode-grapheme-offset-contract');
  for (const text of ['e\u0301', '🇨🇳', '👍🏽', '👨‍👩‍👧‍👦']) {
    assert.equal(truncateGraphemes(text + 'Z', 1), text);
  }
  assert.equal(truncateGraphemes('abc', 0), '');
  assert.throws(() => truncateGraphemes('abc', -1));
});
test('CSV quotes fields while rejecting the documented formula-like input', async () => {
  const { csvTextCell, exportContacts } = await example('csv-export-data-boundary');
  assert.equal(csvTextCell('a,"b"\nc'), '"a,""b""\nc"');
  for (const value of ['=1+1', '  +SUM(1)', '\ttext', '\ntext', '-name', '@name']) assert.throws(() => csvTextCell(value));
  assert.match(exportContacts([{ id: '001', name: '中日', note: 'hello' }]), /"001","中日","hello"\r\n$/);
});
test('stream parser survives every byte boundary and detects incomplete and oversized events', async () => {
  const { readDataEvents } = await example('sse-framing-fetch-streams');
  const bytes = new TextEncoder().encode('data: 中文\r\ndata: next\r\n\r\ndata:\n\n');
  const consume = async chunks => {
    const stream = new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(x); c.close(); } });
    const out = []; for await (const event of readDataEvents(stream)) out.push(event); return out;
  };
  for (let split = 1; split < bytes.length; split++) assert.deepEqual(await consume([bytes.slice(0, split), bytes.slice(split)]), ['中文\nnext', '']);
  assert.deepEqual(await consume([...bytes].map(x => Uint8Array.of(x))), ['中文\nnext', '']);
  await assert.rejects(consume([new TextEncoder().encode('data: unfinished')]), /incomplete/);
  const oversized = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: ' + 'x'.repeat(70000))); c.close(); } });
  await assert.rejects(async () => { for await (const unused of readDataEvents(oversized)) void unused; }, /large/);
});
test('local lock remains held until its work settles and unavailable attempts do no work', async () => {
  const { runAsLeader } = await example('web-locks-leader-fencing');
  let held = false, finish;
  const locks = { async request(_name, _options, work) {
    if (held) return work(null);
    held = true; try { return await work({}); } finally { held = false; }
  } };
  const signal = new AbortController().signal;
  const first = runAsLeader(locks, signal, () => new Promise(resolve => { finish = resolve; }));
  assert.equal(await runAsLeader(locks, signal, () => assert.fail('duplicate')), false);
  assert.equal(held, true); finish(); assert.equal(await first, true); assert.equal(held, false);
});
test('history branches and detects conflicts before moving history entries', async () => {
  const { CaptionHistory } = await example('undo-redo-command-history');
  const h = new CaptionHistory({ a: 'one' }, 2);
  h.execute('a', 'two'); h.execute('a', 'three'); assert.equal(h.undo(), true);
  assert.equal(h.state.a, 'two'); assert.equal(h.redo(), true);
  h.undo(); h.execute('a', 'branch'); assert.equal(h.redo(), false);
  h.state = { a: 'external' }; assert.throws(() => h.undo(), /conflict/); assert.equal(h.past.length, 2);
});
test('URL normalization is idempotent and rejects invalid query states', async () => {
  const { canonicalSearch, parseFilters } = await example('url-query-state-canonicalization');
  for (const q of ['', '?q=中文%2B&status=open&status=open&page=-1', '?page=99999', '?status=closed&status=open&page=02']) {
    const canonical = canonicalSearch(q); assert.equal(canonicalSearch(canonical), canonical);
    assert.deepEqual(parseFilters(canonical), parseFilters(q));
  }
});
test('composition confirmation publishes once and disposal prevents queued updates', async () => {
  const { bindSearch } = await example('ime-composition-input-contract');
  const input = new EventTarget(); input.value = '';
  const changes = [], submits = []; const dispose = bindSearch(input, x => changes.push(x), x => submits.push(x));
  input.dispatchEvent(new Event('compositionstart')); input.value = '中'; input.dispatchEvent(new Event('input'));
  input.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Enter', isComposing: true }));
  assert.deepEqual(changes, []); assert.deepEqual(submits, []);
  input.dispatchEvent(new Event('compositionend')); input.dispatchEvent(new Event('input')); await Promise.resolve();
  assert.deepEqual(changes, ['中']);
  input.value = 'new'; dispose(); input.dispatchEvent(new Event('input')); assert.deepEqual(changes, ['中']);
});
test('a camera result resolving after stop is released without attachment', async () => {
  const { cameraSession } = await example('camera-resource-lease-lifecycle');
  let resolve, stopped = 0;
  const video = { srcObject: null, async play() {} };
  const session = cameraSession({ getUserMedia: () => new Promise(r => { resolve = r; }) }, video);
  const pending = session.start(); session.stop(); resolve({ getTracks: () => [{ stop() { stopped++; } }] });
  assert.equal(await pending, false); assert.equal(stopped, 1); assert.equal(video.srcObject, null);
});
test('decimal parsing and signed rounding preserve minor-unit arithmetic', async () => {
  const { parseCents, roundRatioHalfAway } = await example('decimal-money-input-rounding');
  assert.equal(parseCents('999999999999999999.99'), 99999999999999999999n);
  assert.equal(parseCents('-0.00'), 0n);
  for (const text of ['1e3', '.5', '1.', '01', '0.001', '9'.repeat(129)]) assert.throws(() => parseCents(text));
  assert.equal(roundRatioHalfAway(5n, 2n), 3n); assert.equal(roundRatioHalfAway(-5n, 2n), -3n);
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'blog-publish-test-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  const put = (file, value) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), value); };
  git('init', '-q'); git('config', 'user.name', 'Publication Test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  for (const file of countFiles) put(file, '0');
  put('scripts/sync-article-counts.js', `const fs=require('node:fs');const files=${JSON.stringify(countFiles)};const n=fs.readdirSync('docs/posts/2026/10',{recursive:true}).filter(x=>x.endsWith('.md')).length;for(const f of files)fs.writeFileSync(f,String(n));`);
  put('docs/posts/2026/10/.keep', ''); git('add', '.'); git('commit', '-qm', 'fixture');
  const entries = structuredClone(manifest.entries.slice(0, 2));
  for (const entry of entries) {
    entry.sha256 = {};
    for (const file of entry.files) {
      const source = `---\ndate: ${entry.publishedAt.slice(0, 19).replace('T', ' ')}\n---\n${entry.slug}\n`;
      put(file, source); entry.sha256[file] = digest(source);
    }
  }
  put('scripts/publication-2026-autumn.json', JSON.stringify({ entries }));
  for (const file of countFiles) put(file, '2');
  return { root, git, entries };
}
test('publication dry-run leaves HEAD and index intact; applying creates five-locale commits with incremental counters and both dates', () => {
  const { root, git, entries } = fixture();
  try {
    const before = git('rev-parse', 'HEAD'); const index = git('ls-files', '--stage');
    assert.equal(publish(root).pending, 2); assert.equal(git('rev-parse', 'HEAD'), before); assert.equal(git('ls-files', '--stage'), index);
    assert.equal(publish(root, { apply: true }).committed, 2);
    const commits = git('rev-list', '--reverse', `${before.trim()}..HEAD`).trim().split('\n');
    for (let i = 0; i < commits.length; i++) {
      const dates = git('show', '-s', '--format=%aI%n%cI', commits[i]).trim().split('\n');
      assert.deepEqual(dates, [entries[i].commitAt, entries[i].commitAt]);
      assert.equal(git('show', `${commits[i]}:README.md`), String(i + 1));
      const files = git('diff-tree', '--no-commit-id', '--name-only', '-r', commits[i]).trim().split('\n');
      assert.equal(files.filter(x => /posts\/.*\.md$/.test(x)).length, 5);
    }
    assert.equal(git('diff', '--cached', '--name-only'), ''); assert.equal(git('diff', '--name-only'), '');
    assert.equal(publish(root, { apply: true }).committed, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('publication rejects staged changes and changed article hashes before any commit', () => {
  const { root, git, entries } = fixture();
  try {
    git('add', 'README.md'); const before = git('rev-parse', 'HEAD');
    assert.throws(() => publish(root, { apply: true }), /staged/);
    writeFileSync(join(root, entries[0].files[0]), 'changed'); assert.throws(() => publish(root), /Article changed/);
    assert.equal(git('rev-parse', 'HEAD'), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pagination merge retains identity and time-zone example distinguishes repeated local time', async () => {
  const { appendPage } = await example('cursor-pagination-consistency');
  assert.deepEqual(appendPage([{ id: 'a', title: 'old' }, { id: 'b' }], [{ id: 'a', title: 'new' }, { id: 'c' }]),
    [{ id: 'a', title: 'new' }, { id: 'b' }, { id: 'c' }]);
  const { formatMeeting } = await example('timezone-calendar-intent');
  assert.equal(formatMeeting('2026-11-01T05:30:00Z', 'America/New_York'), formatMeeting('2026-11-01T06:30:00Z', 'America/New_York'));
});
test('download streams into the sink and aborts the destination on an HTTP failure', async () => {
  const { saveResponse } = await example('large-download-stream-lifecycle');
  const original = globalThis.fetch;
  try {
    let closed = false, aborted = false; const chunks = [], progress = [];
    const handle = { createWritable: async () => new WritableStream({
      write(chunk) { chunks.push(chunk); }, close() { closed = true; }, abort() { aborted = true; },
    }) };
    globalThis.fetch = async () => new Response(new TextEncoder().encode('中文'));
    assert.equal(await saveResponse('/fixture', async () => handle, new AbortController().signal, n => progress.push(n)), 6);
    assert.equal(closed, true); assert.equal(progress.at(-1), 6);
    assert.equal(new TextDecoder().decode(chunks[0]), '中文');
    globalThis.fetch = async () => new Response('error', { status: 500 });
    await assert.rejects(saveResponse('/fixture', async () => handle, new AbortController().signal), /500/);
    assert.equal(aborted, true);
  } finally { globalThis.fetch = original; }
});
test('conditional saving sends the validator, preserves a conflicting draft, and rejects weak tags', async () => {
  const { saveDraft } = await example('etag-concurrent-edit-conflicts');
  const original = globalThis.fetch; const draft = { title: 'local' };
  try {
    globalThis.fetch = async (_url, options) => { assert.equal(options.headers['If-Match'], '"r1"'); return new Response(null, { status: 412 }); };
    assert.deepEqual(await saveDraft('/fixture', draft, '"r1"'), { kind: 'conflict', draft });
    await assert.rejects(saveDraft('/fixture', draft, 'W/"r1"'), /strong/);
    globalThis.fetch = async () => new Response(null, { status: 204, headers: { ETag: '"r2"' } });
    assert.deepEqual(await saveDraft('/fixture', draft, '"r1"'), { kind: 'saved', etag: '"r2"' });
  } finally { globalThis.fetch = original; }
});
