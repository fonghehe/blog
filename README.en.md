# Frontend Growth Blog

[中文](./README.md) | [日本語](./README.ja.md) | [繁體中文（台灣）](./README.zh-tw.md) | [繁體中文（香港）](./README.zh-hk.md)

A frontend engineer's learning and growth journey starting from 2018.

**Read online**: https://fonghehe.github.io/blog/en/

## 📖 Content

- **📅 Latest Posts**: [2026 Articles](https://fonghehe.github.io/blog/en/posts/) - Latest frontend trends and deep dives
- **📚 Archive**: [2018–2025](https://fonghehe.github.io/blog/en/archive/) - Years of technical insights

## 🌐 Languages

| Language                        | Link                                   |
| ------------------------------- | -------------------------------------- |
| 中文 (Default)                  | https://fonghehe.github.io/blog/       |
| English                         | https://fonghehe.github.io/blog/en/    |
| 日本語                          | https://fonghehe.github.io/blog/ja/    |
| Traditional Chinese (Taiwan)    | https://fonghehe.github.io/blog/zh-tw/ |
| Traditional Chinese (Hong Kong) | https://fonghehe.github.io/blog/zh-hk/ |

## Tech Stack

- **Framework**: VitePress 1.6.4
- **Languages**: Markdown + Vue 3 + TypeScript
- **Deployment**: GitHub Pages + GitHub Actions
- **Package Manager**: pnpm
- **Theme**: Custom dark/light theme

## 🚀 Local Development

```bash
pnpm install
pnpm docs:dev
```

## 🏗️ Build

```bash
pnpm docs:build
```

## 👁️ Preview Build

```bash
pnpm docs:preview
```

## 📝 Article Stats

- 2018–2025: 1,383 articles (archived)
- 2026: 146 latest articles
- Total: 1,529 in-depth technical articles

## 🎯 Main Topics

- Vue Ecosystem
- React Latest Updates
- Angular Framework
- Engineering & Build Tools
- Performance Optimization
- Security Best Practices
- TypeScript in Practice
- Node.js Development
- Testing & Quality
- CSS New Features
- Mobile & Cross-Platform Development

## 📄 License

MIT

## Maintenance and quality checks

Use Node.js 22.18+ and the pnpm version in `packageManager`.

```bash
pnpm check
pnpm content:report
pnpm docs:build
```

See [reading paths](docs/en/guides.md), [editorial policy](docs/en/about.md) and the [content review report](maintenance/content-quality-report.md). Articles support `updated`, `lastVerified`, `version` and `series`; only record a verification date after checking the relevant behavior. Filters and pagination are shareable URLs. CI checks every language and rejects new issues against the documented debt baseline.

The full build merges both language groups, sitemaps and five RSS feeds, then regenerates the final worker. Offline caching covers entry resources and visited pages; it does not download the entire archive. Mechanical content cleanup is not verification of every article.
