---
title: "Webpack 3 Code Splitting and Lazy Loading in Practice"
date: 2018-01-04 17:02:09
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "After the project grew, `vendor.js` ballooned to 1.8MB and initial load time hit 8 seconds. This article covers the diagnostic and optimization process that bro"
wordCount: 195
---

After the project grew, `vendor.js` ballooned to 1.8MB and initial load time hit 8 seconds. This article covers the diagnostic and optimization process that brought it down to 680KB.

## Step 1: Diagnose with webpack-bundle-analyzer

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  plugins: [new BundleAnalyzerPlugin()],
};
```

Running `npm run build` opens a treemap in your browser showing what's taking up space. Our culprits: lodash (entire library), moment.js with all locales, element-ui (entire component library).

## Step 2: Split Vendor Libraries (CommonsChunkPlugin)

```javascript
// webpack.config.js
module.exports = {
  entry: {
    app: "./src/main.js",
    vendor: ["vue", "vue-router", "vuex", "axios", "element-ui"],
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
      minChunks: Infinity,
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: "manifest",
      minChunks: Infinity,
    }),
  ],
};
```

The `manifest` chunk stores Webpack's runtime. Without extracting it, changing any file invalidates `vendor.js`'s hash (breaking long-term caching).

## Step 3: Dynamic Import for Routes

The biggest win: lazy-load routes so users only download what they visit.

```javascript
// Before: all pages bundled into vendor
import UserList from "@/views/UserList";
import OrderList from "@/views/OrderList";

// After: each route becomes its own chunk
const routes = [
  {
    path: "/users",
    component: () => import(/* webpackChunkName: "user" */ "@/views/UserList"),
  },
  {
    path: "/users/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "@/views/UserDetail"),
  },
  {
    path: "/orders",
    component: () =>
      import(/* webpackChunkName: "order" */ "@/views/OrderList"),
  },
];
```

The `/* webpackChunkName: "user" */` magic comment groups related routes into one chunk.

## Step 4: Component Lazy Loading

For heavy components not needed on initial render:

```javascript
export default {
  components: {
    // Rich text editor only loaded when user opens the editor
    RichEditor: () => import("@/components/RichEditor"),

    // Charts only loaded when chart tab is active
    Charts: () => ({
      component: import("@/components/Charts"),
      loading: { template: "<div>Loading...</div>" },
      delay: 200,
    }),
  },
};
```

## Step 5: Moment.js Optimization

Moment.js includes all locale files by default — 200KB+. Use `ContextReplacementPlugin` to only include what you need:

```javascript
plugins: [
  new webpack.ContextReplacementPlugin(
    /moment[/\\]locale$/,
    /zh-cn/, // only include Chinese locale
  ),
];
```

Or switch to day.js (2KB vs 200KB).

## Results

| Optimization       | vendor.js size |
| ------------------ | -------------- |
| Baseline           | 1.8MB          |
| CommonsChunk       | 1.5MB          |
| Route lazy loading | 800KB          |
| Moment fix         | 680KB          |

Initial load went from 8s to 3.2s. For a production app with long-term caching of `vendor.js`, subsequent visits drop to under 1s.
