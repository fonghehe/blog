# Final implementation review — 2026-10-24

Verdict at review time: request changes for the five P2 findings below. No P0/P1 issue established. These findings were sent to the implementing agent as soon as verified; this report records the inspected version, and subsequent fixes require targeted verification.

## Scope and evidence

- Read-only review of theme components, URL filter composable/pure helpers, SEO, RSS, build merge, generated worker, CI, content validation and cleanup. This report is the only file written by the reviewer.
- Approved scope: `maintenance/blog-improvements.md`; implementation package: `/tmp/blog-review-package.md`. Sampled the rewritten English ESLint article, editorial policy, selected discovery paths and generated output rather than reading all mechanical article copies.
- `/tmp/blog-tests.log` records 17 passing tests and all-language validation of 8,147 pages / 7,590 articles, with 499 known boilerplate findings and no new detected findings.
- `/tmp/blog-build-final.log` records both successful production builds. Generated merged artifacts were inspected. A subsequent `metaChunk: true` build in `/tmp/blog-build-meta.log` was still changing output during review; missing files during that rebuild were not treated as defects.
- Vue review applied the Vue best-practices skill. No full build was rerun, no code/index was edited, and no commits/pushes were performed.

## Findings

### P2 — Exclude search indexes from shell precaching

Location: `scripts/lib/publishing.mjs:97–103`.

`finalizePwa` adds every modulepreload URL from the five home pages to `SHELL`. The real merged output includes six `@localSearchIndex` chunks, each roughly 3.5–4 MB. The inspected shell totals **30,332,131 uncompressed bytes**. Thus every first installation and changed-worker installation fetches all language indexes even if the reader never opens search. This undermines the intended limited precache and is material on mobile connections; `addAll` also makes any failed optional index prevent worker installation.

Exclude lazy search indexes and other optional dependencies explicitly. Keep both builds' entry modules, required imports, home page modules and the new metadata modules. Verify against real generated output, asserting both absence of search indexes and a reasonable byte budget; the tiny synthetic fixture currently cannot detect this.

### P2 — Cache SPA-visited articles and their initial-load modules

Location: `scripts/lib/publishing.mjs:164–170` (with fallback at lines 155–161).

Only a request with `mode === 'navigate'` enters the page cache. Normal VitePress internal article navigation loads JavaScript modules without requesting the corresponding HTML. After reading an article through such a link, going offline and refreshing it finds neither its HTML nor a matching shell entry and returns 503. In addition, VitePress loads a normal `.js` page module during SPA navigation but the `.lean.js` module during initial hydration (`node_modules/vitepress/dist/client/app/index.js`), so HTML-only prefetching is insufficient.

Capture the actual visited route and cache its HTML plus initial-load dependencies, or implement a compatible offline shell fallback. Add a browser test for home → internal article link → offline → refresh, including a traditional Chinese locale. The existing worker test supplies document navigations directly and does not cover the site's actual navigation path.

### P2 — Connect translated 404 content to the layout slot

Location: `docs/.vitepress/theme/index.ts:79–87`.

The custom component is assigned to `Theme.NotFound`, but this app renders `DefaultTheme.Layout`. Its `VPContent.vue` renders its own default NotFound when `page.isNotFound` is true unless the `not-found` slot is supplied. The custom fallback route component is not rendered by that branch. The translated heading and localized article/archive links therefore remain unused. The inspected generated 404 HTML also lacked the custom component's `error-actions`, `error-title` and `not-found-inner` classes.

Supply `"not-found": () => h(NotFound)` in the layout slots. Verify an unknown URL under every locale and a direct load, not just the source component. Check locale resolution for unknown routes under the `/blog/` deployment base.

### P2 — Detect every known unsupported claim removed by cleanup

Location: `scripts/lib/content.mjs:34–35`.

The validator only recognizes four wording prefixes, while `content-cleanup.mjs` removes a much larger exact-phrase set. Reintroducing several known bad statements into a new article passes validation and receives no review label. Direct reproduction returned `issues: []` for both of these strings even though `cleanKnownContent` removes them:

- `This approach has been running stably in production for over half a year, so it is battle-tested.`
- `这套方案已经在线上稳定运行半年多，经受过真实流量验证。`

Share the known-claim list or detection helper between cleanup and validation, preserving the policy of not inferring whether arbitrary experience claims are true. Test each known phrase and distinguish prose from code examples. The file/rule/detail baseline itself properly rejects new fingerprints; the defect is in discovery before baseline comparison.

### P2 — Normalize real parsed YAML dates, not only timestamp strings

Location: `scripts/lib/publishing.mjs:21–29`, called by `docs/.vitepress/rss.ts` and `docs/.vitepress/seo.ts`.

The function documents that unzoned historical timestamps represent China wall-clock time, but VitePress parses unquoted YAML timestamps into `Date` objects first. For the actual ESLint article's `date: 2023-09-08 15:28:03`, `createMarkdownRenderer` returns `Date(2023-09-08T15:28:03.000Z)`. The helper therefore emits 15:28Z; passing the original timestamp string emits 07:28Z as intended. The generated article JSON-LD confirmed the former. Real RSS/SEO instants are consequently eight hours later than the stated policy, and same-day scheduled-feed inclusion can also be delayed.

Preserve enough raw timestamp/zone information at the parsing boundary to apply the intended interpretation. Do not blindly subtract eight hours from every Date, because explicitly zoned input must remain correct. Test the real Markdown/frontmatter parsing path with unzoned, date-only and explicitly zoned values.

## Checks with no concrete defect established

- Pure filters reject malformed category/page values, search title/summary/tags, clamp pages, retain unrelated query parameters and omit defaults. The composable restores on mount, route changes and popstate; no specific state-loss defect was established by source tracing.
- Lists, recommendations and related reading filter by locale; cross-build language navigation deliberately reloads the document. Discovery paths resolve existing locale-specific slugs.
- SEO uses page-specific canonical/social data and existing translation files, and JSON-LD escapes HTML delimiters and Unicode line separators. Per-page attribute escaping is delegated to VitePress.
- RSS has five distinct feed configurations, excludes draft/future/index candidates, limits feed items, and avoids double `/blog/` prefixes. The real-input date issue is listed above.
- Merge validates required inputs before mutation, unions sitemap entries, preserves main assets and adds variant hash entries. Parent must recheck generated metadata entry modules after the new `metaChunk` build.
- Worker cache names are versioned, runtime cache entry counts are bounded, the old blog Workbox precache is deleted on activation, and unrelated caches are retained. Immediate activation and old-tab/offline upgrade behavior still need browser evidence.
- The rewritten sample ESLint article preserves its publication date, adds an update date, explains the chronology and distinguishes a teaching example from production evidence. Editorial policies explicitly acknowledge unverified historical content.

## Declined to judge / remaining evidence limits

- Did not run an actual browser, screen reader, mobile device or real service-worker update lifecycle. Pure helper tests do not establish back/forward rendering, keyboard focus, hydration or offline browser behavior.
- Did not verify every historical article, translation or technical claim. Mechanical cleanup and a green baseline are not corpus correctness evidence. Did not independently revalidate external ESLint release/support references.
- Did not treat local validation as proof of remote GitHub Actions, Pages deployment, analytics, Giscus availability or crawler indexing.
- Did not inspect every generated URL or all 7,590 article translations. The validator checks local Markdown link targets, not external URLs, all fragment IDs, arbitrary HTML/Vue-generated links or every frontmatter navigation link.
- Did not judge dependency vulnerability status or perform an exhaustive security audit; no such current assessment follows from these tests.
- The working tree was being updated concurrently by the implementing agent. Final acceptance should use the final output and targeted fixes, not this report's intermediate artifact sizes alone.

## Author verification of fixes — 2026-10-31

The five findings above describe the initial inspected implementation. Their
fixes are now implemented and checked by the author; the attempted independent
re-review was unavailable due to its usage limit and did not issue an approval.

| Initial finding | Fix and evidence |
| --- | --- |
| Search indexes precached | Shared entry parser excludes search indexes. Real generated shell: 26 URLs, 5.92 MiB; output checker enforces a 12 MiB budget. |
| SPA offline refresh | Route completion caches the actual HTML and initial hydration dependencies. A Traditional Chinese article opened from a home link was refreshed after stopping the preview server; title, body and styling remained available. |
| Localized 404 wiring | Connected the layout slot. Browser checked all five locale headings and home links. VitePress's generated 404 HTML is intentionally an empty SSR shell, so runtime evidence is used. |
| Claim detection gap | Validator and cleanup share the same exact-phrase set; tests iterate all known variants and ignore code examples. |
| YAML date inconsistency | Documented UTC interpretation for unzoned YAML timestamps, preserving explicit offsets. Tests compare real parsed YAML with corresponding string inputs and reject invalid calendar strings. |

Fresh verification: 20 tests passed; both split production builds passed; 8,147
merged sitemap URLs and five RSS channels passed artifact checks. Content scan
covers 7,590 article translations with 499 known boilerplate candidates and no
new detected issues. Mechanical cleanup replay found no unexpected changes in
3,037 changed article files, excluding the five explicit rewrites and five
pre-existing newly added articles. Full article/translation correctness, remote
CI/deployment and external services are not established by this verification.
