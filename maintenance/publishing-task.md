# Publishing task

Own only docs/.vitepress/config.ts, docs/.vitepress/rss.ts,
docs/.vitepress/merge-builds.js, new docs/.vitepress/seo.ts, new
scripts/lib/publishing.mjs, scripts/finalize-pwa.js, tests/publishing.test.mjs,
and docs/public/social-card.png (generate with sharp). Do not edit package.json,
workflows, themes, content or count-sync script; communicate integration needs.

Preserve the existing uncommitted edits in config/rss. Existing VitePress 1.6.x,
Vue 3, native Node 24 tests. No dependency installation or Git commits. Use real
behavior tests (node --test) and watch regression tests fail before fixes. Do not
spawn agents. Other work is occurring in this checkout: do not revert it.

Deliver:
- Per-page social title/description/URL/type/locale, canonical, alternate links
  only for existing translations, x-default, five RSS discovery links scoped to
  page locale, BlogPosting JSON-LD only for dated articles; safe JSON escaping.
  Correct article/updated dates; real checked-in PNG social card. Retain analytics.
  Keep valid plain metadata on index pages and translated website names.
- Five language RSS feeds, correct locale channel URLs, skip drafts and future
  dates, relative source URLs resolved exactly once under /blog/.
- Merge both sitemap outputs (deduplicate shared root entries) alongside the
  existing assets/hashmap merge. Fail when expected locale outputs are missing.
- Restrict service worker precache to shell/icon assets; cache visited pages and
  JS/CSS on demand with bounded caches, timeout/fallback behavior and old cache
  cleanup. Generate final SW after merging so all language apps work offline.
  Avoid caching analytics or giscus and avoid precaching thousands of chunks.
  Ensure final manifest/register script exists for both build groups. Tell parent
  the exact command to add after merge in package.json and deploy workflow.
- Cross-build links must stay functional with current full-page reload boundary.
  Do not merely enable ignoreDeadLinks globally: existing content debt will be
  validated/baselined by a separate parent-owned script, so build may retain the
  existing ignoreDeadLinks flag with explanation until debt is resolved.
- Build helper tests with temporary sitemap fixtures for shared/different locale
  paths, missing variants and repeated merge; SEO tests for escaping and nonarticle
  pages; no source-text assertions. Document report in maintenance/publishing-report.md.

Keep count-marker strings required by scripts/sync-article-counts.js (config:
Chinese article count; rss: Chinese, English, Japanese counts) or tell the parent
how to update the checker without dropping its enforcement.
