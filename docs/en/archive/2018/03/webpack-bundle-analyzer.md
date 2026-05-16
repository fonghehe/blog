---
title: "webpack-bundle-analyzer: Bundle Analysis in Practice"
date: 2018-03-10 16:56:12
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "You finish a build and find `vendor.js` is 3 MB and loading slowly, but you have no idea which libraries are taking up the most space. `webpack-bundle-analyzer`"
---

You finish a build and find `vendor.js` is 3 MB and loading slowly, but you have no idea which libraries are taking up the most space. `webpack-bundle-analyzer` is the standard tool for this problem.

## Installation and Configuration

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "server", // starts an analysis server, default port 8888
      openAnalyzer: true, // automatically opens the browser
      // analyzerMode: 'static', // generate a static HTML report
      // reportFilename: 'report.html'
    }),
  ],
};
```

To avoid affecting regular development, only enable it when needed:

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "analyze": "ANALYZE=true webpack --mode production"
  }
}
```

```javascript
// webpack.config.js
const analyze = process.env.ANALYZE;

module.exports = {
  plugins: [analyze && new BundleAnalyzerPlugin()].filter(Boolean),
};
```

## Reading the Analysis Report

The report opens as a treemap:

- **Area** = file size (before gzip)
- **Color depth** = number of contained modules
- **Clickable to expand** = view the specific modules included

Key things to look for:

1. Which libraries in `node_modules` are the largest
2. Whether any modules are bundled multiple times
3. Whether any of your own business code is unexpectedly large

## Common Optimization Targets

### 1. Entire lodash Being Bundled

```javascript
// ❌ This bundles the entire lodash (71KB gzipped)
import _ from "lodash";
const result = _.chunk([1, 2, 3, 4], 2);

// ✅ Import only the functions you need (individual lodash functions are a few KB each)
import chunk from "lodash/chunk";
const result = chunk([1, 2, 3, 4], 2);

// Or install lodash-es (tree-shaking friendly)
import { chunk } from "lodash-es";
```

### 2. moment.js Locale Files

moment.js bundles all locale files by default (~160KB). Most projects only use a couple of locales:

```javascript
// webpack.config.js
const webpack = require("webpack");

module.exports = {
  plugins: [
    // Keep only Chinese and English
    new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /zh-cn|en/),
  ],
};
```

Or switch to `day.js` outright (only 2KB, mostly API-compatible).

### 3. Element UI On-Demand Loading

```bash
npm install babel-plugin-component
```

```json
// .babelrc
{
  "plugins": [
    [
      "component",
      {
        "libraryName": "element-ui",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}
```

```javascript
// ❌ Full import (~500KB)
import ElementUI from "element-ui";
Vue.use(ElementUI);

// ✅ On-demand import (only bundles the components you use)
import { Button, Table, Form, Input } from "element-ui";
Vue.use(Button);
Vue.use(Table);
```

### 4. Route Lazy Loading

```javascript
// ❌ Everything bundled into the main bundle
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";

// ✅ Load on demand
const HomePage = () => import("@/pages/HomePage");
const AboutPage = () => import("@/pages/AboutPage");

// Group related routes into one chunk
const UserProfile = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserProfile");
const UserSettings = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserSettings");
```

### 5. Use CDN External Links

```javascript
// webpack.config.js
module.exports = {
  externals: {
    vue: "Vue",
    "element-ui": "ELEMENT",
    echarts: "echarts",
  },
};
```

```html
<!-- index.html - load from CDN -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.5.21/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.4.11/lib/index.js"></script>
```

## A Real Optimization Record

| Optimization                 | Before      | After     |
| ---------------------------- | ----------- | --------- |
| Full lodash → on-demand      | 71KB        | 3KB       |
| Full moment → day.js         | 230KB       | 2KB       |
| Element UI on-demand loading | 500KB       | 200KB     |
| Route lazy loading           | All upfront | On demand |
| **Total size**               | **1.8MB**   | **680KB** |

After gzip, size is reduced by another ~70%. Final first-screen JS dropped from 540KB to ~200KB.

## Summary

- Use `webpack-bundle-analyzer` to visualize and find problems first
- lodash and moment are common size culprits — address them specifically
- UI library on-demand loading delivers significant gains
- Route lazy loading greatly improves the first-screen experience
- Don't optimize blindly — measure first, then act
