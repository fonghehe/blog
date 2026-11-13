# Content quality report

Scanned 8212 pages and 7655 article translations.

These are review candidates found by mechanical checks, not a claim that all other content is correct.
Existing issues are baselined transparently; CI rejects newly introduced issues. Fixing a repeated sentence does not validate the rest of an article.

| Rule | Article/page findings |
| --- | ---: |
| boilerplate-introduction | 499 |

## Recommended review order

1. Title/code mismatches and unsupported production claims.
2. Chronology, source references and incomplete translations.
3. Replace generic introductions with the specific problem and applicable version.

## Examples by rule

### boilerplate-introduction

- `docs/archive/2019/09/css-subgrid.md:11` — 很多开发者只停留在 API 调用层面
- `docs/archive/2020/02/react-hooks-custom-patterns.md:7` — 很多开发者只停留在 API 调用层面
- `docs/archive/2020/04/ts-conditional-types.md:7` — 很多开发者只停留在 API 调用层面
- `docs/archive/2020/04/ts-recursive-types.md:7` — 很多开发者只停留在 API 调用层面
- `docs/archive/2020/05/esbuild-introduction.md:7` — 很多开发者只停留在 API 调用层面
- `docs/archive/2020/05/snowpack-dev-server.md:7` — 很多开发者只停留在 API 调用层面
- `docs/archive/2020/06/css-subgrid.md:11` — 很多开发者只停留在 API 调用层面
- `docs/archive/2020/06/nestjs-intro.md:11` — 很多开发者只停留在 API 调用层面

## Commands

`pnpm content:check` checks for new regressions. `pnpm content:report` refreshes this summary.
The baseline contains every known file/rule/detail fingerprint. Inspect a rule with `rg` and the cited files; do not regenerate the baseline to hide new failures.
