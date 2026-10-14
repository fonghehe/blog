#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, SITE_URL } from './lib/publishing.mjs';

const root = 'docs/.vitepress/dist';
const read = file => readFileSync(join(root, file), 'utf8');
const sitemap = read('sitemap.xml');
const allUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(new Set(allUrls).size, allUrls.length, 'Sitemap contains duplicate URLs');
for (const locale of LOCALES) {
  const prefix = locale.prefix ? locale.prefix + '/' : '';
  for (const path of ['index.html', 'posts/index.html', 'about.html', 'guides.html', 'posts/2026/09/mobile-accessibility-rn-flutter.html']) {
    const file = prefix + path;
    const html = read(file);
    const canonical = SITE_URL + file.replace(/index\.html$/, '');
    assert.ok(html.includes(`rel="canonical" href="${canonical}"`), `Wrong canonical: ${file}`);
    assert.ok(html.includes(`property="og:url" content="${canonical}"`), `Wrong share URL: ${file}`);
    assert.ok(!html.includes('<script>window.__VP_HASH_MAP__='), `Repeated inline metadata: ${file}`);
    for (const [, src] of html.matchAll(/(?:src|href)="(\/blog\/assets\/[^"?#]+)(?:[^" ]*)"/g)) {
      assert.ok(existsSync(join(root, decodeURIComponent(src.slice('/blog/'.length)))), `Missing asset ${src} in ${file}`);
    }
  }
  const home = read(prefix + 'index.html');
  assert.ok(home.includes(`href="/blog/${prefix}rss.xml"`), `Missing RSS navigation for ${locale.lang}`);
  const feed = read(prefix + 'rss.xml');
  assert.ok(feed.includes(`<link>${SITE_URL}${prefix}</link>`), `Wrong RSS channel: ${locale.lang}`);
  assert.ok(allUrls.includes(SITE_URL + prefix), `Missing locale in sitemap: ${locale.lang}`);
}
const worker = read('sw.js');
const shell = JSON.parse(worker.match(/^const SHELL = (.*);$/m)[1]);
assert.ok(!shell.some(url => url.includes('@localSearchIndex')), 'Search index must load on demand');
let precacheBytes = 0;
for (const url of shell) {
  let file = url.slice('/blog/'.length);
  if (!file || file.endsWith('/')) file += 'index.html';
  precacheBytes += statSync(join(root, file)).size;
}
assert.ok(precacheBytes < 12 * 1024 * 1024, 'Review offline entry budget: exceeds 12 MiB');
// VitePress emits its 404 shell without SSR body content; the localized layout
// slot is checked in the browser after the fallback route hydrates.
assert.ok(/<script type="module" src="\/blog\/assets\/app\./.test(read('404.html')), '404 shell has no app entry');
let bytes = 0;
function size(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) size(file);
    else bytes += statSync(file).size;
  }
}
size(root);
console.log(`Verified 5 locales, ${allUrls.length} sitemap URLs, localized RSS, SEO, assets and 404.\nOffline entry: ${shell.length} URLs / ${(precacheBytes / 1024 / 1024).toFixed(2)} MiB. Total output: ${(bytes / 1024 / 1024).toFixed(2)} MiB.`);
