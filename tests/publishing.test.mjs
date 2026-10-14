import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { createPageHead } from '../docs/.vitepress/seo.ts';
import { articleUrl, selectFeedPosts, mergeBuilds, finalizePwa, publicationDate } from '../scripts/lib/publishing.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'blog-publishing-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const meta = (head, property) => head.find(([tag, attrs]) => tag === 'meta' && (attrs.property === property || attrs.name === property))?.[1].content;

test('article metadata uses page locale, existing translations and safely escaped dates/schema', async (t) => {
  const root = await fixture(t);
  for (const file of ['posts/a.md', 'en/posts/a.md', 'zh-tw/posts/a.md']) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), '---\ntitle: article\n---');
  }
  const title = 'A </script><script>alert(1)</script> & "quote"';
  const head = createPageHead({ relativePath: 'en/posts/a.md', title, description: 'Page description', frontmatter: { date: '2026-01-02 10:20:30', updated: '2026-02-03' }, lastUpdated: Date.parse('2026-03-04') }, root);
  assert.equal(meta(head, 'og:title'), title);
  assert.equal(meta(head, 'og:description'), 'Page description');
  assert.equal(meta(head, 'og:url'), 'https://fonghehe.github.io/blog/en/posts/a.html');
  assert.equal(meta(head, 'og:type'), 'article');
  assert.equal(meta(head, 'og:locale'), 'en_US');
  assert.equal(meta(head, 'og:site_name'), 'Frontend Growth Blog');
  assert.equal(meta(head, 'article:published_time'), '2026-01-02T10:20:30.000Z');
  assert.equal(meta(head, 'article:modified_time'), '2026-02-03T00:00:00.000Z');
  const alternates = head.filter(([tag, attrs]) => tag === 'link' && attrs.hreflang && !attrs.type);
  assert.deepEqual(alternates.map(([, attrs]) => attrs.hreflang), ['zh-CN', 'en', 'zh-TW', 'x-default']);
  const feeds = head.filter(([tag, attrs]) => tag === 'link' && attrs.type === 'application/rss+xml');
  assert.equal(feeds.length, 5);
  assert.equal(feeds[0][1].href, 'https://fonghehe.github.io/blog/en/rss.xml');
  const schema = head.find(([tag, attrs]) => tag === 'script' && attrs.type === 'application/ld+json')[2];
  assert.ok(!schema.includes('</script>'));
  assert.equal(JSON.parse(schema).headline, title);
  assert.equal(JSON.parse(schema).dateModified, '2026-02-03T00:00:00.000Z');
});

test('index pages retain website metadata without fabricated article dates or schema', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, 'ja'), { recursive: true });
  await writeFile(join(root, 'ja/index.md'), 'home');
  const head = createPageHead({ relativePath: 'ja/index.md', title: '', description: '', frontmatter: { date: '2026-01-02' } }, root);
  assert.equal(meta(head, 'og:type'), 'website');
  assert.equal(meta(head, 'og:title'), 'フロントエンド成長記録');
  assert.equal(meta(head, 'og:url'), 'https://fonghehe.github.io/blog/ja/');
  assert.ok(meta(head, 'og:description'));
  assert.equal(head.some(([tag]) => tag === 'script'), false);
  assert.equal(meta(head, 'article:published_time'), undefined);
  assert.equal(head.some(([, attrs]) => attrs.hreflang === 'x-default'), false);
});

test('RSS excludes drafts, future/invalid dates and indexes and resolves base URL once', () => {
  const posts = [
    { url: '/en/posts/a.html', frontmatter: { date: '2026-01-02', title: 'A' } },
    { url: '/blog/en/posts/b.html', frontmatter: { date: '2026-01-03', title: 'B', draft: true } },
    { url: '/en/posts/future.html', frontmatter: { date: '2027-01-01' } },
    { url: '/en/posts/', frontmatter: { date: '2026-01-01' } },
    { url: '/en/posts/invalid.html', frontmatter: { date: 'not a date' } },
  ];
  const selected = selectFeedPosts(posts, new Date('2026-10-23T00:00:00Z'));
  assert.deepEqual(selected.map(p => p.url), ['/en/posts/a.html']);
  assert.equal(articleUrl('/en/posts/a.html'), 'https://fonghehe.github.io/blog/en/posts/a.html');
  assert.equal(articleUrl('/blog/en/posts/a.html'), 'https://fonghehe.github.io/blog/en/posts/a.html');
  assert.equal(articleUrl('en/posts/a.html'), 'https://fonghehe.github.io/blog/en/posts/a.html');
});

async function buildFixture(root) {
  for (const file of ['main/index.html', 'main/en/index.html', 'main/ja/index.html', 'variant/zh-tw/index.html', 'variant/zh-hk/index.html', 'main/assets/main.js', 'variant/assets/variant.js']) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), file);
  }
  await writeFile(join(root, 'main/hashmap.json'), JSON.stringify({ index: 'a', 'en_index': 'b' }));
  await writeFile(join(root, 'variant/hashmap.json'), JSON.stringify({ index: 'other', 'zh-tw_index': 'c', 'zh-hk_index': 'd' }));
  const xml = paths => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>https://fonghehe.github.io/blog/${p}</loc><lastmod>2026-01-01</lastmod></url>`).join('')}</urlset>`;
  await writeFile(join(root, 'main/sitemap.xml'), xml(['', 'en/', 'ja/', 'posts/shared.html']));
  await writeFile(join(root, 'variant/sitemap.xml'), xml(['', 'zh-tw/', 'zh-hk/', 'posts/shared.html', 'zh-tw/posts/a.html']));
}

test('merge unions sitemaps once and preserves both app asset/hash maps on repeated runs', async (t) => {
  const root = await fixture(t);
  await buildFixture(root);
  mergeBuilds(join(root, 'main'), join(root, 'variant'));
  const sitemap = await readFile(join(root, 'main/sitemap.xml'), 'utf8');
  assert.equal((sitemap.match(/<url>/g) || []).length, 7);
  assert.ok(sitemap.includes('/zh-tw/posts/a.html'));
  assert.equal(await readFile(join(root, 'main/assets/variant.js'), 'utf8'), 'variant/assets/variant.js');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'main/hashmap.json'))), { index: 'a', en_index: 'b', 'zh-tw_index': 'c', 'zh-hk_index': 'd' });
  mergeBuilds(join(root, 'main'), join(root, 'variant'));
  assert.equal(await readFile(join(root, 'main/sitemap.xml'), 'utf8'), sitemap);
});

test('merge fails before changing output if expected locale or sitemap is missing', async (t) => {
  const root = await fixture(t);
  await buildFixture(root);
  await rm(join(root, 'variant/zh-hk'), { recursive: true });
  assert.throws(() => mergeBuilds(join(root, 'main'), join(root, 'variant')), /zh-hk/);
  assert.equal((await readFile(join(root, 'main/sitemap.xml'), 'utf8')).includes('zh-tw'), false);
  await mkdir(join(root, 'variant/zh-hk'));
  await writeFile(join(root, 'variant/zh-hk/index.html'), 'home');
  await rm(join(root, 'variant/sitemap.xml'));
  assert.throws(() => mergeBuilds(join(root, 'main'), join(root, 'variant')), /sitemap/);
});

// Execute the generated worker in an isolated service-worker environment. Request,
// Response and URL are real platform APIs; only browser cache storage/network are adapters.
async function workerHarness(code, offline = false, responses = {}) {
  const listeners = new Map();
  const stores = new Map([['blog-pwa-old-pages', new Map()], ['unrelated-cache', new Map()]]);
  const key = request => typeof request === 'string' ? new URL(request, 'https://fonghehe.github.io').href : request.url;
  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(request, options = {}) {
          const exact = entries.get(key(request));
          if (exact || !options.ignoreSearch) return exact?.clone();
          const wanted = new URL(key(request));
          return [...entries].find(([url]) => {
            const candidate = new URL(url);
            return candidate.origin === wanted.origin && candidate.pathname === wanted.pathname;
          })?.[1].clone();
        },
        async put(request, response) { entries.set(key(request), response.clone()); },
        async addAll(urls) { for (const url of urls) entries.set(key(url), new Response('shell')); },
        async keys() { return [...entries.keys()].map(url => new Request(url)); },
        async delete(request) { return entries.delete(key(request)); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const requests = [];
  const self = { location: new URL('https://fonghehe.github.io/blog/sw.js'), clients: { claim() {} }, skipWaiting() {}, addEventListener(name, fn) { listeners.set(name, fn); } };
  vm.runInNewContext(code, { self, caches: cacheApi, URL, Request, Response, fetch: async request => { const url = key(request); requests.push(url); if (offline) throw new Error('offline'); return responses[url] ? new Response(responses[url], {headers:{'Content-Type':'text/html'}}) : new Response('network'); }, setTimeout, clearTimeout, Promise });
  async function lifecycle(name) { const work = []; listeners.get(name)({ waitUntil(p) { work.push(p); } }); await Promise.all(work); }
  async function fetchPage(url, destination = '') {
    let result;
    const pending = [];
    const request = new Request(url);
    Object.defineProperties(request, { mode: { value: destination === 'document' ? 'navigate' : 'cors' }, destination: { value: destination } });
    listeners.get('fetch')({ request, respondWith(p) { result = p; }, waitUntil(p) { pending.push(p); } });
    const response = await result;
    await Promise.all(pending);
    return response;
  }
  async function cachePage(url) { const work = []; listeners.get('message')({ data: {type:'CACHE_PAGE',url}, waitUntil(p) { work.push(p); } }); await Promise.all(work); }
  return { stores, requests, lifecycle, fetchPage, cachePage, setOffline(value) { offline = value; } };
}

test('final worker precaches a small shell and serves visited pages/assets offline with bounded caches', async (t) => {
  const root = await fixture(t);
  await buildFixture(root);
  mergeBuilds(join(root, 'main'), join(root, 'variant'));
  finalizePwa(join(root, 'main'));
  const manifest = JSON.parse(await readFile(join(root, 'main/manifest.webmanifest')));
  assert.equal(manifest.scope, '/blog/');
  assert.ok((await readFile(join(root, 'main/registerSW.js'), 'utf8')).includes('/blog/sw.js'));
  const worker = await workerHarness(await readFile(join(root, 'main/sw.js'), 'utf8'));
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  assert.equal(worker.stores.has('blog-pwa-old-pages'), false);
  assert.equal(worker.stores.has('unrelated-cache'), true);
  const precache = [...worker.stores.values()].flatMap(store => [...store.keys()]);
  assert.ok(precache.length <= 10);
  assert.ok(precache.every(url => !url.includes('@localSearchIndex') && !url.includes('/assets/')));
  for (let i = 0; i < 75; i++) await worker.fetchPage(`https://fonghehe.github.io/blog/zh-hk/posts/${i}.html`, 'document');
  await worker.fetchPage('https://fonghehe.github.io/blog/assets/variant.js', 'script');
  worker.setOffline(true);
  assert.equal(await (await worker.fetchPage('https://fonghehe.github.io/blog/zh-hk/posts/74.html', 'document')).text(), 'network');
  assert.equal(await (await worker.fetchPage('https://fonghehe.github.io/blog/assets/variant.js', 'script')).text(), 'network');
  const unavailable = await worker.fetchPage('https://fonghehe.github.io/blog/en/never-visited.html', 'document');
  assert.equal(unavailable.status, 503);
  assert.ok((await unavailable.text()).includes('offline'));
  assert.ok([...worker.stores.values()].every(store => store.size <= 120));
  assert.equal(await worker.fetchPage('https://cloud.umami.is/script.js', 'script'), undefined);
  assert.equal(await worker.fetchPage('https://giscus.app/client.js', 'script'), undefined);
});

test('offline shell includes only entry assets and works on the first offline reload', async (t) => {
  const root = await fixture(t);
  await buildFixture(root);
  const main = join(root, 'main');
  await writeFile(join(main, 'index.html'), '<link rel="preload stylesheet" href="/blog/assets/app.css"><link rel="modulepreload" href="/blog/assets/vendor.js"><link rel="modulepreload" href="/blog/assets/@localSearchIndexroot.js"><script type="module" src="/blog/assets/main.js"></script>');
  await writeFile(join(main, 'assets/app.css'), 'body{}');
  await writeFile(join(main, 'assets/vendor.js'), 'export {}');
  await writeFile(join(main, 'assets/@localSearchIndexroot.js'), 'big search index');
  await writeFile(join(main, 'assets/article-unvisited.js'), 'export {}');
  finalizePwa(main);
  const worker = await workerHarness(await readFile(join(main, 'sw.js'), 'utf8'));
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  worker.setOffline(true);
  assert.equal((await worker.fetchPage('https://fonghehe.github.io/blog/assets/@localSearchIndexroot.js', 'script')).status, 503);
  assert.equal(await (await worker.fetchPage('https://fonghehe.github.io/blog/assets/main.js', 'script')).text(), 'shell');
  assert.equal(await (await worker.fetchPage('https://fonghehe.github.io/blog/assets/app.css', 'style')).text(), 'shell');
  assert.equal((await worker.fetchPage('https://fonghehe.github.io/blog/assets/article-unvisited.js', 'script')).status, 503);
});

test('SPA route caching saves the HTML and lean module needed by offline refresh', async (t) => {
  const root = await fixture(t);
  await buildFixture(root);
  finalizePwa(join(root, 'main'));
  const url = 'https://fonghehe.github.io/blog/zh-tw/posts/a.html';
  const html = '<link rel="modulepreload" href="/blog/assets/zh-tw_a.lean.js"><link rel="modulepreload" href="/blog/assets/@localSearchIndexzh-tw.js"><h1>Article</h1>';
  const worker = await workerHarness(await readFile(join(root, 'main/sw.js'), 'utf8'), false, {[url]: html});
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  await worker.cachePage(url + '?utm_source=home');
  worker.setOffline(true);
  assert.equal(await (await worker.fetchPage(url + '?category=Mobile', 'document')).text(), html);
  assert.equal(await (await worker.fetchPage('https://fonghehe.github.io/blog/assets/zh-tw_a.lean.js', 'script')).text(), 'network');
  assert.ok(!worker.requests.some(url => url.includes('@localSearchIndex')));
});

test('real parsed YAML timestamps agree with strings and preserve explicit offsets', async () => {
  const { createMarkdownRenderer } = await import('vitepress');
  const md = await createMarkdownRenderer(process.cwd());
  for (const value of ['2023-09-08 15:28:03', '2023-09-08', '2023-09-08T15:28:03+08:00', '2023-09-08T15:28:03Z']) {
    const env = {};
    md.render(`---\ndate: ${value}\n---\n`, env);
    assert.equal(publicationDate(env.frontmatter.date).toISOString(), publicationDate(value).toISOString());
  }
  assert.equal(publicationDate('2026-02-31'), undefined);
});

test('RSS output exposes five distinct channel URLs and language feeds', async () => {
  const { FEEDS, createRssFeed } = await import('../docs/.vitepress/rss.ts');
  assert.equal(FEEDS.length, 5);
  for (const [index, link] of ['https://fonghehe.github.io/blog/', 'https://fonghehe.github.io/blog/en/', 'https://fonghehe.github.io/blog/ja/', 'https://fonghehe.github.io/blog/zh-tw/', 'https://fonghehe.github.io/blog/zh-hk/'].entries()) {
    const xml = createRssFeed(FEEDS[index], [{ url: '/blog/en/posts/a.html', frontmatter: { date: '2026-01-01', title: '<A & B>' } }], new Date('2026-10-23')).rss2();
    assert.ok(xml.includes(`<link>${link}</link>`));
    assert.ok(xml.includes('/blog/en/posts/a.html'));
    assert.ok(!xml.includes('/blog/blog/'));
  }
});

test('search indexing retains heading and prose while omitting fences and generated Vue markup', async () => {
  const { createMarkdownRenderer } = await import('vitepress');
  const { renderSearchMarkdown } = await import('../docs/.vitepress/seo.ts');
  const md = await createMarkdownRenderer(process.cwd());
  const env = { relativePath: 'posts/example.md' };
  const html = renderSearchMarkdown('---\ntitle: Searchable title\n---\n# Useful heading\n\nSearchable explanation with `inlineTerm` and [a link](https://example.com).\n\n```js\nsecretCodeOnly()\n```\n\n<PostList :generated="true" />\n', env, md);
  assert.ok(html.includes('Useful heading'));
  assert.ok(html.includes('Searchable explanation'));
  assert.ok(html.includes('inlineTerm'));
  assert.ok(!html.includes('secretCodeOnly'));
  assert.ok(!html.includes('PostList'));
  assert.equal(renderSearchMarkdown('---\nsearch: false\n---\n# Private page', {}, md), '');
});
