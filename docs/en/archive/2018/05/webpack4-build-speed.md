---
title: "Webpack 4 Performance Optimization: Build Speed"
date: 2018-05-03 14:57:54
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "As projects grow larger, Webpack build times get longer and every wait is lost productivity. This article covers proven build-speed optimizations."
---

As projects grow larger, Webpack build times get longer and every wait is lost productivity. This article covers proven build-speed optimizations.

## Measure First: Find the Bottleneck

Before optimizing, know where the time is going:

```bash
npm install --save-dev speed-measure-webpack-plugin
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  // your webpack config
});
```

The output shows how long each loader and plugin takes. Find the slowest ones and optimize those.

## Optimization 1: Narrow the Build Scope

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "babel-loader",
        include: path.resolve(__dirname, "src"), // only process src/
        exclude: /node_modules/, // skip node_modules
      },
    ],
  },
  resolve: {
    // Tell webpack where to find modules
    modules: [path.resolve(__dirname, "src"), "node_modules"],
    // Fewer extension searches
    extensions: [".js", ".vue"], // only add .json, .css if needed
    // Module aliases (avoid deep relative paths)
    alias: {
      "@": path.resolve(__dirname, "src"),
      vue$: "vue/dist/vue.esm.js", // point directly to the file
    },
  },
};
```

## Optimization 2: babel-loader Cache

```javascript
{
  test: /\.js$/,
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true  // enable cache — subsequent builds are much faster
    }
  }
}
```

The first build is slow; subsequent builds only process changed files.

## Optimization 3: Multi-threaded Build

```bash
npm install --save-dev thread-loader
```

```javascript
{
  test: /\.js$/,
  use: [
    {
      loader: 'thread-loader',
      options: { workers: 2 }  // number of worker threads; try CPU cores - 1
    },
    'babel-loader'
  ]
}
```

**Note**: spinning up threads has overhead. Only beneficial for computationally heavy loaders.

## Optimization 4: DLL Pre-compilation

Pre-compile rarely changing third-party libraries (React, Vue, Element UI) and reference them directly during development:

```javascript
// webpack.dll.js
const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: {
    vendor: ["vue", "vuex", "vue-router", "axios", "element-ui"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_[hash]",
  },
  plugins: [
    new webpack.DllPlugin({
      path: path.join(__dirname, "dll", "[name]-manifest.json"),
      name: "[name]_[hash]",
    }),
  ],
};
```

```bash
# Build the DLL first (only once; re-run when dependencies change)
webpack --config webpack.dll.js
```

```javascript
// webpack.config.js — reference the DLL
plugins: [
  new webpack.DllReferencePlugin({
    context: __dirname,
    manifest: require("./dll/vendor-manifest.json"),
  }),
];
```

**Measured result:** with Vue full stack + Element UI in the vendor bundle, build time dropped from 45s to 12s.

## Optimization 5: hard-source-webpack-plugin

Module-level cache — easier to configure than DLL:

```bash
npm install --save-dev hard-source-webpack-plugin
```

```javascript
const HardSourceWebpackPlugin = require("hard-source-webpack-plugin");

plugins: [new HardSourceWebpackPlugin()];
```

First build time unchanged; subsequent builds show a significant improvement (60%+ speed gain).

## Results Comparison

Based on a mid-size Vue project (~200 components):

| Optimization       | Build time     |
| ------------------ | -------------- |
| Baseline           | 48s            |
| babel-loader cache | 32s            |
| + DLL              | 18s            |
| + thread-loader    | 14s            |
| + hard-source      | 8s (2nd build) |

## Checking for Further Gains

```bash
# Analyse the bundle
npm install --save-dev webpack-bundle-analyzer

# After building, open the report:
# Any unexpectedly large modules?
# Any duplicate bundles?
```

## Summary

- Measure first — use `speed-measure-webpack-plugin` to find the bottleneck
- Enabling `babel-loader` cache is the simplest optimization
- DLL pre-compilation has a big impact for third-party libraries
- `hard-source-webpack-plugin` is a quick win for global module caching
- Don't blindly increase thread count — too many threads can actually slow things down
