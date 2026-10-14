import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { createMarkdownRenderer } from 'vitepress';
import { publicationDate } from './publishing.mjs';
import { repeatedClaims } from './content-cleanup.mjs';

export const localeDirs = ['', 'en', 'ja', 'zh-tw', 'zh-hk'];

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'public') return [];
    const file = join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : [];
  }).sort();
}

export function issueId(issue) {
  const hash = createHash('sha256').update(issue.detail).digest('hex').slice(0, 12);
  return `${issue.file}:${issue.rule}:${hash}`;
}

export function newIssues(issues, baseline) {
  const known = new Set(baseline);
  return issues.filter(issue => !known.has(issueId(issue)));
}

export function qualityIssues(file, source) {
  const issues = [];
  function record(rule, match) {
    issues.push({ file, rule, detail: match[0].trim(), line: source.slice(0, match.index).split('\n').length });
  }
  // These exact recurring statements have no supporting deployment context in
  // the templates. Findings request evidence; they do not prove a claim false.
  const prose = source.replace(/```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~/g, code => code.replace(/[^\n]/g, ' '));
  let offset = 0;
  for (const line of prose.split('\n')) {
    if (repeatedClaims.has(line.trim())) record('unsupported-production-claim', { 0: line.trim(), index: offset });
    offset += line.length + 1;
  }
  const boilerplate = /很多开发者只停留在 API 调用层面|很多開發者[只隻]停留在 API 呼叫層面|many developers only stay at the API call level|多くの開発者はAPIの呼び出しレベルにとどまっています/g;
  for (const match of source.matchAll(boilerplate)) record('boilerplate-introduction', match);
  for (const match of source.matchAll(/```(?:javascript|js|typescript|ts)\s*\n([\s\S]*?)```/g)) {
    if (/^(?:\.[\w-]+|#[\w-]+|:root|@(?:media|container)|html\b|body\b)/.test(match[1].trim())
      && /[\w-]+\s*:\s*[^;{}]+;/.test(match[1])) record('code-language-mismatch', match);
  }
  return issues;
}

function linkExists(docsDir, file, href) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return true;
  let path;
  try { path = decodeURIComponent(href.split(/[?#]/)[0]); } catch { return false; }
  if (!path) return true;
  path = path.replace(/^\/blog(?:\/|$)/, '/');
  const target = path.startsWith('/') ? resolve(docsDir, '.' + path) : resolve(dirname(file), path);
  if (target !== docsDir && !target.startsWith(docsDir + '/')) return false;
  const rel = relative(docsDir, target);
  if (/(^|\/)rss\.xml$/.test(rel) || ['manifest.webmanifest', 'sw.js', 'registerSW.js', 'sitemap.xml', 'robots.txt'].includes(rel)) return true;
  const paths = extname(target) === '.html'
    ? [target.replace(/\.html$/, '.md'), target]
    : [target, target + '.md', join(target, 'index.md')];
  return paths.some(p => existsSync(p)) || existsSync(join(docsDir, 'public', rel));
}

export async function inspectContent(root, { checkTranslations = true, now = new Date() } = {}) {
  const docsDir = resolve(root);
  const files = markdownFiles(docsDir);
  const sources = new Set(files.map(file => relative(docsDir, file)));
  const issues = [];
  const md = await createMarkdownRenderer(docsDir, { highlight: () => '' }, '/blog/');
  // Parse real Markdown/YAML without creating thousands of HTML strings.
  md.renderer.render = (tokens, _options, env) => { env.tokens = tokens; return ''; };
  let articles = 0;
  const byLocale = {};
  const add = (file, rule, detail, line = 1) => issues.push({ file, rule, detail, line });
  for (const file of files) {
    const name = relative(docsDir, file);
    const source = readFileSync(file, 'utf8');
    const env = { relativePath: name };
    try { md.render(source, env); }
    catch (error) { add(name, 'invalid-markdown', error.message); continue; }
    const fm = env.frontmatter || {};
    const article = /^(?:(?:en|ja|zh-tw|zh-hk)\/)?(?:posts|archive)\/.+\.md$/.test(name) && !name.endsWith('/index.md');
    if (article) {
      articles++;
      const locale = name.match(/^(en|ja|zh-tw|zh-hk)\//)?.[1] || 'zh';
      byLocale[locale] = (byLocale[locale] || 0) + 1;
      if (typeof fm.title !== 'string' || !fm.title.trim()) add(name, 'missing-title', 'Article needs a nonempty title');
      const date = publicationDate(fm.date);
      if (!date) add(name, 'invalid-date', 'Article needs a valid publication date');
      else if (date > now && !fm.draft) add(name, 'future-date', String(fm.date));
      if (!Array.isArray(fm.tags) || !fm.tags.length || fm.tags.some(tag => typeof tag !== 'string' || !tag.trim())) add(name, 'invalid-tags', 'Article tags must be a nonempty string array');
      if (typeof fm.description !== 'string' || !fm.description.trim()) add(name, 'missing-description', 'Article needs a description');
      for (const field of ['readingTime', 'wordCount']) if (!Number.isFinite(fm[field]) || fm[field] <= 0) add(name, 'invalid-metadata', `${field} must be a positive number`);
      for (const field of ['updated', 'lastVerified']) {
        if (fm[field] && (!publicationDate(fm[field]) || publicationDate(fm[field]) < date)) add(name, 'invalid-maintenance-date', `${field} must be valid and no earlier than publication`);
      }
      if (checkTranslations) {
        const articlePath = name.replace(/^(en|ja|zh-tw|zh-hk)\//, '');
        for (const locale of localeDirs) {
          const translated = [locale, articlePath].filter(Boolean).join('/');
          if (!sources.has(translated)) add(name, 'missing-translation', translated);
        }
      }
      issues.push(...qualityIssues(name, source));
      if (/ESLint\s*v?9/i.test(fm.title) && date && date < new Date('2024-04-05') && !fm.updated) add(name, 'chronology-review', 'ESLint v9 article predates stable release; clarify historical context or update date');
    }
    function visit(tokens) {
      for (const token of tokens) {
        for (const attr of token.attrs || []) {
          if ((token.type === 'link_open' && attr[0] === 'href') || (token.type === 'image' && attr[0] === 'src')) {
            if (!linkExists(docsDir, file, attr[1])) add(name, 'broken-link', attr[1], (token.map?.[0] || 0) + 1);
          }
        }
        if (token.children) visit(token.children);
      }
    }
    visit(env.tokens || []);
  }
  const unique = [...new Map(issues.map(issue => [issueId(issue), issue])).values()];
  return { files: files.length, articles, byLocale, issues: unique };
}
