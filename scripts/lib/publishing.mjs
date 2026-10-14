import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const SITE_URL = 'https://fonghehe.github.io/blog/';
export const LOCALES = [
  { prefix: '', lang: 'zh-CN', ogLocale: 'zh_CN', title: '前端成长记录', description: '一个前端工程师从 2018 年开始的学习与成长记录。' },
  { prefix: 'en', lang: 'en', ogLocale: 'en_US', title: 'Frontend Growth Blog', description: "A frontend engineer’s learning journey since 2018." },
  { prefix: 'ja', lang: 'ja', ogLocale: 'ja_JP', title: 'フロントエンド成長記録', description: '2018年から始まるフロントエンドエンジニアの学習・成長記録。' },
  { prefix: 'zh-tw', lang: 'zh-TW', ogLocale: 'zh_TW', title: '前端成長記錄', description: '一個前端工程師從 2018 年開始的學習與成長記錄。' },
  { prefix: 'zh-hk', lang: 'zh-HK', ogLocale: 'zh_HK', title: '前端成長記錄', description: '一個前端工程師從 2018 年開始的學習與成長記錄。' },
];

// ContentLoader URLs may already include VitePress's base. Strip it once before
// resolving to the canonical deployment root, rather than concatenating /blog/.
export function articleUrl(value) {
  const source = String(value).replace(/^\/+/, '');
  return new URL(source.replace(/^blog(?:\/|$)/, ''), SITE_URL).href;
}

export function publicationDate(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return undefined;
  // Match YAML's UTC interpretation of unquoted, unzoned historical timestamps.
  // Explicit offsets stay intact; never reinterpret an already parsed Date.
  const normalized = typeof value === 'string' && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?$/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (typeof value === 'string') {
    const calendar = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (calendar) {
      const check = new Date(Date.UTC(Number(calendar[1]), Number(calendar[2]) - 1, Number(calendar[3])));
      if (check.toISOString().slice(0, 10) !== calendar[0]) return undefined;
    }
  }
  return date;
}

export function selectFeedPosts(posts, now = new Date()) {
  return posts.filter(post => {
    const date = publicationDate(post.frontmatter?.date);
    return date && date <= now && !post.frontmatter?.draft &&
      !/\/$|(?:^|\/)index(?:\.html|\.md)?$/.test(post.url);
  }).sort((a, b) => publicationDate(b.frontmatter.date) - publicationDate(a.frontmatter.date)).slice(0, 50);
}

function required(file) {
  if (!existsSync(file)) throw new Error(`Missing required build output: ${file}`);
}

function sitemapEntries(file) {
  const xml = readFileSync(file, 'utf8');
  if (!/<urlset\b/.test(xml) || !/<\/urlset>/.test(xml)) throw new Error(`Invalid sitemap: ${file}`);
  const entries = [...xml.matchAll(/<url(?:\s[^>]*)?>[\s\S]*?<\/url>/g)].map(match => {
    const loc = match[0].match(/<loc>([\s\S]*?)<\/loc>/)?.[1];
    if (!loc) throw new Error(`Missing sitemap URL: ${file}`);
    return [loc, match[0]];
  });
  if (!entries.length) throw new Error(`Empty sitemap: ${file}`);
  return { entries, namespaces: [...(xml.match(/<urlset\b([^>]*)>/)?.[1] || '').matchAll(/xmlns(?::[\w-]+)?="[^"]*"/g)].map(match => match[0]) };
}

function mergeAssets(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const target = join(dst, entry.name);
    if (entry.isDirectory()) mergeAssets(join(src, entry.name), target);
    else if (!existsSync(target)) cpSync(join(src, entry.name), target);
  }
}

export function mergeBuilds(main, variants) {
  // Validate the entire input contract before changing the main output.
  for (const file of ['index.html', 'en/index.html', 'ja/index.html', 'assets', 'hashmap.json', 'sitemap.xml']) required(join(main, file));
  for (const file of ['zh-tw/index.html', 'zh-hk/index.html', 'assets', 'hashmap.json', 'sitemap.xml']) required(join(variants, file));
  const mainMap = JSON.parse(readFileSync(join(main, 'hashmap.json'), 'utf8'));
  const variantMap = JSON.parse(readFileSync(join(variants, 'hashmap.json'), 'utf8'));
  const first = sitemapEntries(join(main, 'sitemap.xml'));
  const second = sitemapEntries(join(variants, 'sitemap.xml'));
  const entries = new Map(first.entries);
  for (const [url, entry] of second.entries) if (!entries.has(url)) entries.set(url, entry);
  const namespaces = [...new Set([...first.namespaces, ...second.namespaces])].join(' ');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${namespaces}>\n${[...entries.values()].join('\n')}\n</urlset>\n`;
  for (const locale of ['zh-tw', 'zh-hk']) cpSync(join(variants, locale), join(main, locale), { recursive: true, force: true });
  mergeAssets(join(variants, 'assets'), join(main, 'assets'));
  for (const [key, value] of Object.entries(variantMap)) if (/^zh-(tw|hk)_/.test(key)) mainMap[key] = value;
  writeFileSync(join(main, 'hashmap.json'), JSON.stringify(mainMap));
  writeFileSync(join(main, 'sitemap.xml'), sitemap);
  return { sitemapUrls: entries.size, hashEntries: Object.keys(mainMap).length };
}

export function entryAssetUrls(html, base = 'https://fonghehe.github.io/blog/') {
  const urls = [];
  const origin = new URL(base).origin;
  for (const tag of html.matchAll(/<(?:link|script)\b[^>]*>/gi)) {
    const rel = tag[0].match(/\brel=["']([^"']+)["']/i)?.[1].split(/\s+/) || [];
    if (!rel.some(value => value === 'stylesheet' || value === 'modulepreload') && !/type=["']module["']/i.test(tag[0])) continue;
    const href = tag[0].match(/(?:href|src)=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      const url = new URL(href, base);
      if (url.origin !== origin || !(url.pathname.startsWith('/blog/assets/') || url.pathname === '/blog/vp-icons.css')) continue;
      if (decodeURIComponent(url.pathname).includes('@localSearchIndex')) continue;
      urls.push(url.pathname);
    } catch { /* A malformed optional preload must not break offline setup. */ }
  }
  return [...new Set(urls)];
}

export function finalizePwa(outDir) {
  required(join(outDir, 'index.html'));
  const htmlFiles = ['index.html', 'en/index.html', 'ja/index.html', 'zh-tw/index.html', 'zh-hk/index.html'];
  const shellFiles = [...htmlFiles, '404.html', 'favicon.ico', 'logo.png', 'social-card.png'];
  const shellUrls = shellFiles.filter(file => existsSync(join(outDir, file)))
    .map(file => '/blog/' + file.replace(/index\.html$/, ''));
  // Cache the entry dependencies too: registration happens after the first page's
  // assets loaded, so runtime caching alone cannot make its first reload offline.
  for (const file of htmlFiles) {
    if (!existsSync(join(outDir, file))) continue;
    const html = readFileSync(join(outDir, file), 'utf8');
    for (const pathname of entryAssetUrls(html)) {
      if (existsSync(join(outDir, decodeURIComponent(pathname.slice('/blog/'.length))))) shellUrls.push(pathname);
    }
  }
  const shell = [...new Set([...shellUrls, '/blog/registerSW.js', '/blog/manifest.webmanifest'])];
  const hash = createHash('sha256');
  hash.update(serviceWorker.toString()).update(entryAssetUrls.toString()).update(JSON.stringify(shell));
  for (const file of ['hashmap.json', ...['index.html', 'en/index.html', 'ja/index.html', 'zh-tw/index.html', 'zh-hk/index.html', '404.html', 'favicon.ico', 'logo.png', 'social-card.png']]) {
    if (existsSync(join(outDir, file))) hash.update(file).update(readFileSync(join(outDir, file)));
  }
  const version = hash.digest('hex').slice(0, 16);
  const manifest = {
    id: '/blog/', name: '前端成长记录', short_name: '前端记录',
    description: '一个前端工程师从 2018 年开始的学习与成长记录',
    theme_color: '#3c8772', background_color: '#ffffff', display: 'standalone', start_url: '/blog/', scope: '/blog/',
    icons: [{ src: '/blog/logo.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }],
  };
  writeFileSync(join(outDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(outDir, 'registerSW.js'), `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/blog/sw.js', { scope: '/blog/' }).catch(error => console.warn('Offline registration failed', error)); }); }\n`);
  writeFileSync(join(outDir, 'sw.js'), serviceWorker(version, shell));
  const precachedBytes = shell.reduce((sum, url) => {
    const file = url.slice('/blog/'.length) || 'index.html';
    const target = join(outDir, file.endsWith('/') ? file + 'index.html' : file);
    return sum + readFileSync(target).byteLength;
  }, 0);
  return { version, precached: shell.length, precachedBytes };
}

function serviceWorker(version, shell) {
  return `// Generated after locale builds are merged. Precache shell and entry dependencies only.
const PREFIX = 'blog-pwa-';
const VERSION = ${JSON.stringify(version)};
const SHELL = ${JSON.stringify(shell)};
${entryAssetUrls.toString()}
const NAMES = { shell: PREFIX + VERSION + '-shell', pages: PREFIX + VERSION + '-pages', assets: PREFIX + VERSION + '-assets' };
self.addEventListener('install', event => { event.waitUntil((async () => { await (await caches.open(NAMES.shell)).addAll(SHELL); await self.skipWaiting(); })()); });
self.addEventListener('activate', event => { event.waitUntil((async () => { await Promise.all((await caches.keys()).filter(name => (name.startsWith(PREFIX) && !Object.values(NAMES).includes(name)) || (name.startsWith('workbox-precache-') && name.includes('/blog/'))).map(name => caches.delete(name))); await self.clients.claim(); })()); });
async function remember(name, request, response, limit) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(name);
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map(key => cache.delete(key)));
}
function timed(promise) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Network timeout')), 4000); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
async function respond(event, isPage) {
  const request = event.request;
  const name = isPage ? NAMES.pages : NAMES.assets;
  const cache = await caches.open(name);
  const network = fetch(request).then(async response => { await remember(name, request, response, isPage ? 60 : 240).catch(() => {}); return response; });
  // A timed-out request may still complete and refresh the cache in the background.
  event.waitUntil(network.catch(() => {}));
  try {
    const response = await timed(network);
    if (response.ok || response.status < 500) return response;
    throw new Error('Server unavailable');
  } catch {
    const cached = await cache.match(request, { ignoreSearch: isPage });
    if (cached) return cached;
    const shellCache = await caches.open(NAMES.shell);
    const shellResponse = await shellCache.match(request, { ignoreSearch: true });
    if (shellResponse) return shellResponse;
    return new Response(isPage ? 'This page is unavailable offline. Reconnect and try again.' : '', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
async function cacheVisitedPage(href) {
  const url = new URL(href, self.location.href);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/blog/')) return;
  url.search = ''; url.hash = '';
  const response = await fetch(new Request(url.href));
  if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) return;
  const html = await response.clone().text();
  const assets = await caches.open(NAMES.assets);
  const shell = await caches.open(NAMES.shell);
  // The HTML references the lean module used for hydration, whereas SPA
  // navigation only downloaded the full page module. Save both paths.
  for (const path of entryAssetUrls(html, self.location.href)) {
    const asset = new Request(new URL(path, self.location.origin));
    if (await assets.match(asset) || await shell.match(asset)) continue;
    const downloaded = await fetch(asset);
    await remember(NAMES.assets, asset, downloaded, 240);
  }
  await remember(NAMES.pages, new Request(url.href), response, 60);
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_PAGE' || typeof event.data.url !== 'string') return;
  event.waitUntil(cacheVisitedPage(event.data.url).catch(() => {}));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/blog/') || /(?:umami|giscus)/i.test(url.pathname)) return;
  const page = request.mode === 'navigate';
  const asset = /\\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/.test(url.pathname);
  if (page || asset) event.respondWith(respond(event, page));
});
`;
}
