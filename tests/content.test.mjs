import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const load = () => import('../scripts/lib/content.mjs');

test('validates all language metadata and real local links while ignoring code examples', async (t) => {
  const { inspectContent } = await load();
  const root = await mkdtemp(join(tmpdir(), 'blog-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'posts'), { recursive: true });
  await mkdir(join(root, 'en/posts'), { recursive: true });
  await writeFile(join(root, 'index.md'), '# Home');
  await writeFile(join(root, 'posts/a.md'), '---\ntitle: A\ndate: 2026-01-01\ntags: [Vue]\ndescription: Description\nreadingTime: 2\nwordCount: 200\n---\n[Home](/blog/)\n[Missing](./missing.md)\n```md\n[Example](/not-real)\n```');
  await writeFile(join(root, 'en/posts/a.md'), '---\ntitle: A\ndate: nope\ntags: Vue\n---\nBody');
  const result = await inspectContent(root, { checkTranslations: false });
  assert.equal(result.articles, 2);
  assert.ok(result.issues.some((i) => i.file === 'en/posts/a.md' && i.rule === 'invalid-date'));
  assert.ok(result.issues.some((i) => i.file === 'en/posts/a.md' && i.rule === 'invalid-tags'));
  const broken = result.issues.filter((i) => i.rule === 'broken-link');
  assert.equal(broken.length, 1);
  assert.ok(broken[0].detail.includes('missing'));
});

test('quality checks identify repeated unsupported production claims and language-mismatched code', async () => {
  const { qualityIssues } = await load();
  const issues = qualityIssues('posts/a.md', '```javascript\n.container { width: 100%; }\n```\n这套方案已经在线上稳定运行了半年以上，经过了实际验证。');
  assert.ok(issues.some((i) => i.rule === 'unsupported-production-claim'));
  assert.ok(issues.some((i) => i.rule === 'code-language-mismatch'));
  assert.deepEqual(qualityIssues('posts/a.md', '```css\n.container { width: 100%; }\n```'), []);
  assert.deepEqual(qualityIssues('posts/a.md', '```javascript\nclass Card { css = `.container { width: 100%; }` }\n```'), []);
});

test('validator recognizes every cleaned claim in prose and ignores teaching code', async () => {
  const { repeatedClaims } = await import('../scripts/lib/content-cleanup.mjs');
  const { qualityIssues } = await load();
  for (const claim of repeatedClaims) {
    assert.ok(qualityIssues('posts/a.md', claim).some(i => i.rule === 'unsupported-production-claim'), claim);
    assert.deepEqual(qualityIssues('posts/a.md', '```text\n' + claim + '\n```'), []);
  }
});

test('baseline allows only known unchanged debt and rejects new failures', async () => {
  const { newIssues, issueId } = await load();
  const old = { file: 'posts/a.md', rule: 'broken-link', detail: './old', line: 3 };
  const fresh = { file: 'posts/a.md', rule: 'broken-link', detail: './new', line: 3 };
  assert.deepEqual(newIssues([{ ...old, line: 8 }, fresh], [issueId(old)]), [fresh]);
});

test('mechanical cleanup removes only exact repeated claims and corrects stylesheet fence labels', async () => {
  const { cleanKnownContent } = await import('../scripts/lib/content-cleanup.mjs');
  const source = '# Topic\n\n这套方案已经在线上稳定运行了半年以上，经过了实际验证。\n\n```javascript\n.container { width: 100%; }\n```\n\n```javascript\nconst sample = "这套方案已经在线上稳定运行了半年以上，经过了实际验证。";\n```\n';
  const cleaned = cleanKnownContent(source);
  assert.equal(cleaned, '# Topic\n\n\n```css\n.container { width: 100%; }\n```\n\n```javascript\nconst sample = "这套方案已经在线上稳定运行了半年以上，经过了实际验证。";\n```\n');
  assert.equal(cleanKnownContent(cleaned), cleaned);
  assert.equal(cleanKnownContent('A measured production example with data.'), 'A measured production example with data.');
});
