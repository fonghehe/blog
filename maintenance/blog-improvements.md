# Blog improvement plan — 2026-10-23

The user approved implementation of the audit's recommendations. Keep VitePress/Vue,
all five languages, article URLs and existing uncommitted work. Do not publish or
invent personal experience. Work in the existing checkout so its pending content
and count updates remain part of the result. No automatic commits.

Approach: targeted improvements to the existing theme and build pipeline rather
than a theme migration. Content corrections need evidence; a repeatable report
tracks the remaining corpus instead of silently claiming it has been verified.

## Tasks

- [x] Search and reading: URL-backed filters/page state; title, summary and tag
  search; accessible controls; translated article metadata/404; related reading;
  explicit verification/version fields and route-safe reading progress.
- [x] Discovery: localized home recommendations, reading paths, about and RSS
  navigation with no unsupported biographical or project claims.
- [x] Publishing: per-page canonical/social/structured metadata and alternates;
  five RSS feeds; merge multilingual sitemaps; limited precache and on-demand
  offline caching after both builds.
- [x] Content: correct the five ESLint article variants with publication/update
  distinction and official references. Generate a corpus quality report with
  repeated claims and mismatch candidates; add a transparent editorial policy.
- [x] Checks: test real filter/SEO/merge/validation behavior; validate all locales
  and links, baseline existing content debt, fail new regressions; wire CI and
  document commands. Run both production builds and inspect final artifacts.

## Verification focus

History back/forward, refresh and malformed page parameters; locale isolation;
HTML/JSON escaping in metadata; cross-build links and sitemaps; offline caching
of updated chunks; preserving article count parity and existing changes.

## Progress and decisions

- Baseline: main, 12 tracked modified files plus 5 new translated articles.
- Node 24.14.1 and pnpm 11.16.0 available; no existing test command.
- Planning, Vue, testing and verification skills applied. The user's instruction
  to implement the reviewed list authorizes proceeding without another design
  approval. Private planning stays outside the published docs directory.

- Implementation review found five P2 issues; fixes cover optional search-index
  precaching, SPA HTML/lean dependency caching, 404 slot wiring, shared claim
  detection and actual YAML/string date equivalence. Unzoned dates use YAML UTC,
  explicit offsets remain intact; no historical timezone is invented.
- Corpus cleanup removes only the checked-in exact phrase variants and relabels
  unambiguous stylesheet fences; counts and paths remain unchanged. Remaining
  automated review findings: 499 boilerplate candidates across translations.
- `metaChunk: true` avoids repeating the full page map in every generated HTML.
- No Git commit, push or deployment has been performed.

- Final verification on 2026-10-31: 20 tests passed; both production build groups
  passed; merged output verified (8,147 URLs, five feeds, 26 precached entry URLs,
  5.92 MiB precache and 310.88 MiB total). No detected new content issues.
- Replayed the narrow cleanup against HEAD for 3,037 mechanically changed article
  files: no unexpected body/frontmatter differences except refreshed readingTime
  and wordCount. Five explicit ESLint rewrites and five pre-existing new articles
  were handled separately.
- Browser: all five localized 404s; category/page refresh and search → article →
  back restoration; mobile width/scrollWidth 375/375 with first article at630px;
  actual SPA-visited Traditional Chinese article refreshed with preview server
  stopped and retained its title, body and styling. Temporary browser viewport
  restored; test server stopped.
- Initial independent review identified five P2 issues. Fixes passed targeted
  tests and author/browser verification. A second independent review could not
  complete because that reviewer hit its usage limit; do not describe it as an
  independent approval. Historical article correctness and real external services
  remain outside these checks.
