---
title: "Webpack 4 Optimization in Practice: Cutting Build Time by 50%"
date: 2019-01-17 09:30:01
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "When a project grows large, slow build times become maddening. This is our team's real-world record of Webpack 4 optimization — build time went from 3 minutes d"
wordCount: 71
---

When a project grows large, slow build times become maddening. This is our team's real-world record of Webpack 4 optimization — build time went from 3 minutes down to 90 seconds.

## 1. Analyze Build Time

```bash
# Install analysis tools
npm i -D speed-measure-webpack-plugin webpack-bundle-analyzer
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  plugins: [
    new BundleAnalyzerPlugin(), // analyze bundle size
  ],
});
```

First, understand where the bottleneck is — then optimize.

## 2. Multi-Process Compilation

```bash
npm i -D thread-loader
```

```javascript
// Put expensive loaders (babel-loader) into worker processes
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: "thread-loader",
            options: {
              workers: require("os").cpus().length - 1,
              workerParallelJobs: 50,
            },
          },
          "babel-loader?cacheDirectory=true", // enable caching!
        ],
      },
    ],
  },
};
```

## 3. Caching (Critical Optimization)

```javascript
// cache-loader: cache loader results
{
  test: /\.js$/,
  use: ['cache-loader', 'thread-loader', 'babel-loader']
}

// Or use HardSourceWebpackPlugin
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')
plugins: [new HardSourceWebpackPlugin()]

// babel-loader has built-in caching
{
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,
    cacheCompression: false  // don't compress cache for speed
  }
}
```

After the first build, subsequent builds are much faster (we went from 3min → 90s).

## 4. DllPlugin: Pre-Compile Third-Party Libraries

```javascript
// webpack.dll.js: pre-compile vendor
const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: {
    vendor: ["vue", "vue-router", "vuex", "axios", "element-ui"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_dll",
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_dll",
      path: path.join(__dirname, "dll/[name].manifest.json"),
    }),
  ],
};
```

```json
// package.json
{
  "scripts": {
    "dll": "webpack --config webpack.dll.js",
    "build": "webpack"
  }
}
```
