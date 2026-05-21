---
title: "Webpack Common Code Extraction and SplitChunks"
date: 2018-10-25 10:34:15
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "As a project grows with more pages, code shared across multiple pages gets bundled redundantly. `SplitChunks` extracts shared code so the browser can cache and "
wordCount: 119
---

As a project grows with more pages, code shared across multiple pages gets bundled redundantly. `SplitChunks` extracts shared code so the browser can cache and reuse it.

## Why Code Splitting Matters

```
A project with pages A, B, and C — all using lodash and Vue.
Without splitting:
  pageA.js = pageA code + lodash + Vue
  pageB.js = pageB code + lodash + Vue
  pageC.js = pageC code + lodash + Vue
  → lodash and Vue are downloaded 3 times!

After splitting:
  vendor.js = lodash + Vue (downloaded once, long-term cached)
  common.js = shared business code across A/B/C
  pageA.js = pageA's own code (very small)
```

## Webpack 4 SplitChunks

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // applies to all chunks (async/initial/all)

      cacheGroups: {
        // Bundle third-party libraries separately
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 20,
        },

        // Shared business code
        common: {
          name: "common",
          minChunks: 2, // referenced by at least 2 chunks
          chunks: "all",
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

## Finer-grained Splitting

```javascript
cacheGroups: {
  // Vue framework separately (rarely changes — long-term cached)
  vue: {
    test: /[\\/]node_modules[\\/](vue|vue-router|vuex)[\\/]/,
    name: 'vue',
    chunks: 'all',
    priority: 30
  },

  // Element UI separately (large — benefits from separate caching)
  elementUI: {
    test: /[\\/]node_modules[\\/]element-ui[\\/]/,
    name: 'element-ui',
    chunks: 'all',
    priority: 25
  },

  // Other third-party libraries
  vendors: {
    test: /[\\/]node_modules[\\/]/,
    name: 'vendors',
    chunks: 'all',
    priority: 20
  },

  // Project shared code
  common: {
    name: 'common',
    minChunks: 2,
    chunks: 'all',
    priority: 10
  }
}
```

## Runtime Chunk

```javascript
optimization: {
  // Extract webpack's runtime code separately
  // Prevents vendor hash from changing when only the runtime changes
  runtimeChunk: {
    name: "runtime";
  }
}
```

## Caching Strategy

```javascript
output: {
  // contenthash: hash stays the same if content doesn't change — enables long-term browser caching
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

Splitting strategy:

```
runtime.js    → very small, may change with every build
vendor.js     → third-party libs, almost never changes, long-term cached
common.js     → shared business code, changes occasionally
pageA.js      → page code, changes frequently
```

## Vue CLI Default Configuration

Vue CLI already provides sensible defaults — you usually don't need to change them manually:

```javascript
// vue.config.js (only adjust when defaults don't meet your needs)
module.exports = {
  chainWebpack(config) {
    config.optimization.splitChunks({
      cacheGroups: {
        vendors: {
          name: "chunk-vendors",
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: "initial",
        },
      },
    });
  },
};
```

## Results

In our project, after splitting optimization:

```
Before:
  app.js: 1.2 MB (downloaded on first load and every subsequent page)

After:
  vendor.js: 600 KB (downloaded once; cached across all subsequent pages)
  common.js: 100 KB
  Per-page chunks: 30–80 KB each

Total first-load size is similar, but subsequent page navigations only download the page chunk
```

## Summary

- `splitChunks.chunks: 'all'` applies to all code
- `cacheGroups` defines different extraction strategies
- Group third-party libraries by change frequency: core framework, large UI library, everything else
- `contenthash` ensures the cache stays valid as long as content doesn't change
- Vue CLI has sensible defaults — run bundle analyzer before deciding whether to tune
