---
title: "Frontend First-Screen Performance Optimization in Practice"
date: 2018-11-06 16:51:48
tags:
  - Performance
readingTime: 2
description: "First-screen load speed directly impacts user experience. After a round of optimization on our company project, here are the techniques that actually worked."
---

First-screen load speed directly impacts user experience. After a round of optimization on our company project, here are the techniques that actually worked.

## Diagnosing the Problem

Run Lighthouse before optimizing to identify the bottlenecks:

```bash
lighthouse https://yourdomain.com --output html --output-path ./report.html
```

Our project's main issues: FCP 4.2s (target: < 1.8s). Root causes:

- JS bundle too large: main.js at 2.4 MB
- No route lazy loading
- All dependencies loaded synchronously

## Optimization 1: Route Lazy Loading (Biggest Gain)

```javascript
// Before: synchronous imports bundled into main.js
import Dashboard from "./views/Dashboard.vue";
import Users from "./views/Users.vue";

// After: dynamic imports, loaded on demand
const routes = [
  { path: "/dashboard", component: () => import("./views/Dashboard.vue") },
  { path: "/users", component: () => import("./views/Users.vue") },
];
```

Result: main.js dropped from 2.4 MB to 380 KB — the single biggest FCP improvement.

## Optimization 2: gzip/Brotli Compression

```bash
# nginx.conf
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/javascript application/json;
gzip_min_length 1024;

# brotli (better compression ratio than gzip — requires nginx brotli module)
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/javascript;
```

You can also pre-generate compressed files at build time:

```javascript
// webpack: compression-webpack-plugin
const CompressionPlugin = require("compression-webpack-plugin");

plugins: [
  new CompressionPlugin({
    algorithm: "gzip",
    test: /\.(js|css|html)$/,
    threshold: 10240, // compress only files larger than 10 KB
    minRatio: 0.8,
  }),
];
```

## Optimization 3: CDN for Third-party Libraries

```javascript
// vue.config.js: exclude large dependencies from webpack
module.exports = {
  configureWebpack: {
    externals: {
      vue: "Vue",
      "element-ui": "ELEMENT",
      echarts: "echarts",
    },
  },
};
```

```html
<!-- Load from CDN, leveraging caching -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.6.10/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.12.0/lib/index.js"></script>
```

## Optimization 4: Preload Critical Resources

```html
<!-- Tell the browser to load critical fonts/scripts early -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin />
<link rel="preload" href="/js/chunk-vendors.js" as="script" />

<!-- prefetch: load resources that the next page might need in advance -->
<link rel="prefetch" href="/js/dashboard.js" />
```

Vue CLI 3 automatically generates prefetch tags for lazy-loaded chunks.

## Optimization 5: Remove Render Blocking

```html
<!-- CSS in <head>: blocks rendering (required) -->
<link rel="stylesheet" href="main.css" />

<!-- JS at the bottom of <body>, or use defer/async -->
<script defer src="main.js"></script>
<!-- defer: executes in order after HTML is fully parsed -->
<script async src="analytics.js"></script>
<!-- async: executes immediately when downloaded -->
```

## Results

| Metric           | Before | After           |
| ---------------- | ------ | --------------- |
| FCP              | 4.2s   | 1.6s            |
| JS bundle size   | 2.4 MB | 380 KB (+ lazy) |
| Lighthouse score | 42     | 87              |

## Summary

1. Route lazy loading: highest impact, always do it
2. gzip compression: one-time server config, set and forget
3. CDN for third-party libraries: reduces main bundle, leverages caching
4. Preload critical resources: reduces render-blocking time
5. `defer` for JS, async loading for non-critical CSS
