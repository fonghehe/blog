---
title: "Webpack Performance Budget: Enforcing Bundle Size Limits with bundlesize"
date: 2019-02-28 10:47:02
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "Bundle size is a key frontend performance indicator. Projects without constraints tend to quietly balloon — add a library here, add a library there, and suddenl"
---

Bundle size is a key frontend performance indicator. Projects without constraints tend to quietly balloon — add a library here, add a library there, and suddenly you're 100KB over. The idea of a performance budget is like a financial budget: treat the bundle size as a budget, and going over it means overspending.

## Impact of JS Size on Load Performance

| JS Size | 3G Download Time | Parse Time |
| ------- | ---------------- | ---------- |
| 100KB   | ~1s              | ~300ms     |
| 300KB   | ~3s              | ~900ms     |
| 1MB     | ~10s             | ~3s        |

Keep in mind: JS maps to CPU time at roughly 3x the download size. On a 2G device, 1MB of JS can take 30+ seconds before the page is interactive.

## Webpack Built-In Performance Warnings

```javascript
// webpack.config.js
module.exports = {
  performance: {
    maxEntrypointSize: 250 * 1024, // entry point must not exceed 250KB
    maxAssetSize: 100 * 1024, // single asset must not exceed 100KB
    hints: "error", // exceeding the limit causes a build error
  },
};
```

## bundlesize: The Performance Budget Gatekeeper in CI

```bash
npm install --save-dev bundlesize
```

```json
// package.json
{
  "bundlesize": [
    { "path": "./dist/main.*.js", "maxSize": "200 kB" },
    { "path": "./dist/vendor.*.js", "maxSize": "150 kB" },
    { "path": "./dist/*.css", "maxSize": "20 kB" }
  ],
  "scripts": {
    "size": "bundlesize"
  }
}
```

```bash
npm run size
# PASS  ./dist/main.abc123.js: 185.2KB < 200KB gzip
# FAIL  ./dist/vendor.abc123.js: 162.5KB > 150KB gzip
```

## Integrating into CI (GitHub Actions)

```yaml
{% raw %}
# .github/workflows/ci.yml
- name: Check bundle size
  run: npm run build && npm run size
  env:
    BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
{% endraw %}
```

With `BUNDLESIZE_GITHUB_TOKEN` configured, bundlesize will comment directly on the PR with bundle size changes.

## Analyzing the Root Cause of Overruns

```bash
# Visualize analysis with webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/stats.json

# Or use source-map-explorer
npx source-map-explorer dist/main.*.js
```

Common causes of overruns:

1. `moment.js` bundles all locales (use `date-fns` or `dayjs` instead)
2. `lodash` imported in full (avoid `import _ from 'lodash'`)
3. Third-party CSS libraries end up in the index bundle (should be dynamically imported)
4. Images/fonts end up in the JS bundle (configure separate output)

## Summary

The core of a performance budget is establishing metrics and automating their enforcement. `webpack performance hints` + `bundlesize` + CI integration — these three lines of defense ensure that bundle size doesn't silently grow out of control.
