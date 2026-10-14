import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HeadConfig, PageData } from 'vitepress';
import { articleUrl, LOCALES, publicationDate, SITE_URL } from '../../scripts/lib/publishing.mjs';

type SeoPage = Pick<PageData, 'relativePath' | 'title' | 'description' | 'frontmatter'> & { lastUpdated?: number };

export function createPageHead(page: SeoPage, sourceDir: string): HeadConfig[] {
  const relativePath = page.relativePath;
  const locale = LOCALES.find(({ prefix }) => prefix && relativePath.startsWith(prefix + '/')) || LOCALES[0];
  const sourcePath = locale.prefix ? relativePath.slice(locale.prefix.length + 1) : relativePath;
  const urlFor = (file: string) => articleUrl(file.replace(/index\.md$/, '').replace(/\.md$/, '.html'));
  const url = urlFor(relativePath);
  const title = String(page.frontmatter.title || page.title || locale.title);
  const description = String(page.frontmatter.description || page.description || locale.description);
  const published = publicationDate(page.frontmatter.date);
  const article = /^(posts|archive)\//.test(sourcePath) && !/(^|\/)index\.md$/.test(sourcePath) && published && !page.frontmatter.draft;
  const updated = publicationDate(page.frontmatter.updated || page.frontmatter.lastUpdated) || publicationDate(page.lastUpdated) || published;
  const modified = published && updated && updated < published ? published : updated;
  const image = SITE_URL + 'social-card.png';
  const head: HeadConfig[] = [
    ['link', { rel: 'canonical', href: url }],
    ...Object.entries({ 'og:type': article ? 'article' : 'website', 'og:title': title, 'og:description': description, 'og:url': url, 'og:locale': locale.ogLocale, 'og:site_name': locale.title, 'og:image': image, 'og:image:width': '1200', 'og:image:height': '630', 'og:image:type': 'image/png' }).map(([property, content]) => ['meta', { property, content }] as HeadConfig),
    ...Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': title, 'twitter:description': description, 'twitter:image': image }).map(([name, content]) => ['meta', { name, content }] as HeadConfig),
  ];
  for (const translation of LOCALES) {
    const file = [translation.prefix, sourcePath].filter(Boolean).join('/');
    if (existsSync(join(sourceDir, file))) head.push(['link', { rel: 'alternate', hreflang: translation.lang, href: urlFor(file) }]);
  }
  if (existsSync(join(sourceDir, sourcePath))) head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: urlFor(sourcePath) }]);
  // The current language's feed is first for feed readers; all five are discoverable.
  for (const feed of [locale, ...LOCALES.filter(item => item !== locale)]) {
    head.push(['link', { rel: 'alternate', type: 'application/rss+xml', hreflang: feed.lang, title: feed.title, href: articleUrl([feed.prefix, 'rss.xml'].filter(Boolean).join('/')) }]);
  }
  if (article) {
    head.push(['meta', { property: 'article:published_time', content: published.toISOString() }]);
    head.push(['meta', { property: 'article:modified_time', content: modified.toISOString() }]);
    const schema = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: title, description, url, mainEntityOfPage: url, image: [image], datePublished: published.toISOString(), dateModified: modified.toISOString(), inLanguage: locale.lang, publisher: { '@type': 'Organization', name: locale.title, url: articleUrl(locale.prefix + '/') } };
    // Script text must not let frontmatter close the script element or introduce
    // HTML entities/JS line separators. Attributes are escaped by VitePress.
    const json = JSON.stringify(schema).replace(/[<>&\u2028\u2029]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
    head.push(['script', { type: 'application/ld+json' }, json]);
  }
  return head;
}

// VitePress 1.6 supports this through local.options._render. Use its own
// markdown renderer so frontmatter, links and headings keep their semantics.
// Rendering is synchronous: temporary rules cannot overlap another call.
export function renderSearchMarkdown(src: string, env: any, md: any): string {
  const rules = md.renderer.rules;
  const omitted = ['fence', 'code_block', 'html_block', 'html_inline'];
  const originals = omitted.map(name => rules[name]);
  try {
    for (const name of omitted) rules[name] = () => '';
    const html = md.render(src, env);
    if (env.frontmatter?.search === false) return '';
    const title = env.frontmatter?.title;
    return title && !/<h1\b/.test(html) ? `<h1>${md.utils.escapeHtml(String(title))}</h1>\n${html}` : html;
  } finally {
    omitted.forEach((name, index) => {
      if (originals[index]) rules[name] = originals[index];
      else delete rules[name];
    });
  }
}
