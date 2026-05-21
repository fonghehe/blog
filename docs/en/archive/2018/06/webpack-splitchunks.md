---
title: "Webpack splitChunks Code Splitting in Practice"
date: 2018-06-09 16:08:30
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "Webpack 4 replaced the old `CommonsChunkPlugin` with `splitChunks`, making configuration simpler. Here's the setup from a real project."
wordCount: 178
---

Webpack 4 replaced the old `CommonsChunkPlugin` with `splitChunks`, making configuration simpler. Here's the setup from a real project.

## Why Code Split

Without splitting, all code is bundled into a single `main.js`. Every time a user visits, they need to download the entire file even if they'll never use most pages.

After code splitting:

- Common libraries (vue, lodash) are bundled separately to leverage browser cache
- Route-corresponding pages are loaded on demand
- The first screen only loads the necessary code

## Route Lazy Loading (the Simplest Split)

```javascript
// router/index.js
const routes = [
  {
    path: "/dashboard",
    component: () =>
      import(/* webpackChunkName: "dashboard" */ "../views/Dashboard.vue"),
  },
  {
    path: "/users",
    component: () =>
      import(/* webpackChunkName: "users" */ "../views/Users.vue"),
  },
];
```

The `/* webpackChunkName: "xxx" */` comment names the split chunk, making it easier to analyze.

## splitChunks Configuration

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // applies to all chunks (both async and sync)
      cacheGroups: {
        // third-party dependencies bundled separately
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
          chunks: "all",
        },
        // Element UI bundled separately (large and rarely changes)
        elementUI: {
          test: /[\\/]node_modules[\\/]element-ui[\\/]/,
          name: "element-ui",
          priority: 20, // higher priority than vendors
          chunks: "all",
        },
        // Code shared by multiple chunks
        common: {
          minChunks: 2, // referenced by at least 2 chunks
          name: "common",
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    // Extract runtime code separately
    runtimeChunk: {
      name: "runtime",
    },
  },
};
```

## Configuration in Vue CLI 3

```javascript
// vue.config.js
module.exports = {
  chainWebpack: (config) => {
    config.optimization.splitChunks({
      chunks: "all",
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: -10,
          chunks: "all",
        },
      },
    });
  },
};
```

## Analyzing the Bundle

Install `webpack-bundle-analyzer` to see the splitting results:

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  plugins: [new BundleAnalyzerPlugin()],
};
```

## preload/prefetch in HTML

Vue CLI 3 automatically generates `<link rel="prefetch">` tags for lazily-loaded chunks, so the browser preloads them during idle time:

```html
<!-- Auto-generated -->
<link rel="prefetch" href="/js/dashboard.js" />
<link rel="prefetch" href="/js/users.js" />
```

## Summary

- Route lazy loading is the simplest form of code splitting — just one line of code
- `splitChunks.cacheGroups` controls how to group chunks
- Bundle third-party libraries separately to fully leverage browser cache
- Use bundle analyzer to verify the splitting results
