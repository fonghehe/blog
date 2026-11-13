#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const countFiles = [
  'README.md', 'README.en.md', 'README.ja.md', 'README.zh-tw.md', 'README.zh-hk.md',
  'docs/index.md', 'docs/en/index.md', 'docs/ja/index.md', 'docs/zh-tw/index.md', 'docs/zh-hk/index.md',
  'docs/.vitepress/config.ts', 'docs/.vitepress/rss.ts',
];
export const digest = value => createHash('sha256').update(value).digest('hex');

export function publish(root, { apply = false, manifestFile = 'scripts/publication-2026-autumn.json' } = {}) {
  const git = (args, options = {}) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, ...options,
  });
  const manifest = JSON.parse(readFileSync(join(root, manifestFile), 'utf8'));
  const pending = [];
  const seen = new Set();
  let previous = '';
  for (const entry of manifest.entries) {
    if (!/^docs: publish [a-z0-9 -]+$/.test(entry.message)) throw new Error('Invalid commit message');
    if (entry.publishedAt <= previous) throw new Error('Publication dates must increase');
    previous = entry.publishedAt;
    const published = Date.parse(entry.publishedAt), committed = Date.parse(entry.commitAt);
    if (![entry.publishedAt, entry.commitAt].every(date => /^\d{4}-\d\d-\d\dT(?:09|10|11|12|13|14|15|16|17):[0-5]\d:[0-5]\d\+08:00$/.test(date)) ||
        !Number.isFinite(published) || !Number.isFinite(committed) || committed <= published ||
        committed - published > 30 * 60 * 1000 || entry.commitAt.slice(0, 10) !== entry.publishedAt.slice(0, 10) ||
        committed > Date.now()) throw new Error(`Invalid timestamps: ${entry.slug}`);
    const expectedPaths = ['', 'en/', 'ja/', 'zh-tw/', 'zh-hk/'].map(prefix =>
      `docs/${prefix}posts/${entry.publishedAt.slice(0, 4)}/${entry.publishedAt.slice(5, 7)}/${entry.slug}.md`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) ||
        JSON.stringify(entry.files) !== JSON.stringify(expectedPaths)) throw new Error('Invalid locale paths');
    let present = 0;
    for (const file of entry.files) {
      if (seen.has(file)) throw new Error(`Duplicate path: ${file}`);
      seen.add(file);
      const source = readFileSync(join(root, file));
      if (digest(source) !== entry.sha256?.[file]) throw new Error(`Article changed; review and refresh manifest: ${file}`);
      const date = source.toString().match(/^date: (.+)$/m)?.[1];
      if (date !== entry.publishedAt.slice(0, 19).replace('T', ' ')) throw new Error(`Article date mismatch: ${file}`);
      const tracked = git(['ls-tree', '--name-only', 'HEAD', '--', file]).trim();
      if (tracked) {
        if (digest(git(['show', `HEAD:${file}`], { encoding: null })) !== digest(source)) throw new Error(`Tracked article differs: ${file}`);
        present++;
      }
    }
    if (present && present !== 5) throw new Error(`Partially committed translations: ${entry.slug}`);
    if (!present) pending.push(entry);
    console.log(`${present ? 'SKIP' : apply ? 'COMMIT' : 'PLAN'} ${entry.publishedAt} -> ${entry.commitAt} ${entry.slug}`);
  }
  if (!apply || !pending.length) return { committed: 0, pending: pending.length };
  if (git(['diff', '--cached', '--name-only']).trim()) throw new Error('Index contains staged changes; finish them first');
  const changed = git(['diff', '--name-only', 'HEAD', '-z']).split('\0').filter(Boolean);
  if (changed.some(file => !countFiles.includes(file))) throw new Error('Unrelated tracked changes; finish them first');
  if (!git(['symbolic-ref', '--quiet', 'HEAD']).trim()) throw new Error('A checked-out branch is required');
  const originalIndex = git(['ls-files', '--stage']);
  const temp = mkdtempSync(join(tmpdir(), 'blog-publication-'));
  const snapshot = join(temp, 'snapshot');
  mkdirSync(snapshot);
  const env = { ...process.env, GIT_DIR: git(['rev-parse', '--absolute-git-dir']).trim(),
    GIT_WORK_TREE: snapshot, GIT_INDEX_FILE: join(temp, 'index') };
  const isolatedGit = args => git(args, { env });
  const syncCounts = () => execFileSync(process.execPath, ['scripts/sync-article-counts.js'], { cwd: snapshot, encoding: 'utf8' });
  const copyEntry = entry => {
    for (const file of entry.files) {
      const target = join(snapshot, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, file), target);
    }
  };
  let completed = 0;
  let expectedHead = git(['rev-parse', 'HEAD']).trim();
  try {
    const archive = git(['archive', 'HEAD'], { encoding: null });
    execFileSync('tar', ['-xf', '-', '-C', snapshot], { input: archive });
    // Validate final counters before any commit. Never overwrite unreviewed site copy.
    for (const entry of pending) copyEntry(entry);
    syncCounts();
    for (const file of countFiles) {
      if (!readFileSync(join(root, file)).equals(readFileSync(join(snapshot, file)))) {
        throw new Error(`Site counter/copy differs from expected output: ${file}`);
      }
    }
    for (const entry of pending) for (const file of entry.files) rmSync(join(snapshot, file));
    for (const file of countFiles) writeFileSync(join(snapshot, file), git(['show', `HEAD:${file}`], { encoding: null }));
    isolatedGit(['read-tree', 'HEAD']);
    for (const entry of pending) {
      if (git(['rev-parse', 'HEAD']).trim() !== expectedHead) throw new Error('HEAD changed during publication');
      copyEntry(entry);
      syncCounts();
      isolatedGit(['add', '--', ...entry.files, ...countFiles]);
      const output = git(['commit', '-m', entry.message], { env: { ...env,
        GIT_AUTHOR_DATE: entry.commitAt, GIT_COMMITTER_DATE: entry.commitAt } });
      console.log(output.trim());
      expectedHead = git(['rev-parse', 'HEAD']).trim();
      completed++;
    }
  } finally {
    // Commits used a private index; align the original index only if nobody edited it.
    if (completed) {
      if (git(['ls-files', '--stage']) !== originalIndex) {
        console.error('Original index changed concurrently; left it untouched. Inspect git status.');
      } else git(['read-tree', 'HEAD']);
    }
    rmSync(temp, { recursive: true, force: true });
  }
  return { committed: completed, pending: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--dry-run', '--apply'].includes(arg)) || new Set(args).size !== args.length || args.length > 1) {
      throw new Error('Usage: node scripts/publish-2026-autumn.mjs [--dry-run | --apply]');
    }
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    console.log(JSON.stringify(publish(root, { apply: args.includes('--apply') })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
