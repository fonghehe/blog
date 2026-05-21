---
title: "The Difference Between Webpack Loaders and Plugins"
date: 2018-04-27 10:45:43
tags:
  - Webpack
readingTime: 1
description: "`module.rules` (loaders) and `plugins` are the two most important configuration sections in Webpack, but many people can't clearly distinguish between them."
wordCount: 80
---

`module.rules` (loaders) and `plugins` are the two most important configuration sections in Webpack, but many people can't clearly distinguish between them.

## Core Difference

```
Loader: file transformer
  - Acts on individual files
  - Converts file type A into a JS module Webpack understands
  - Triggered when a file is imported/required

Plugin: build-process extension
  - Acts on the entire build pipeline
  - Listens to Webpack lifecycle events and does extra work at the right time
  - More powerful, but also more complex to configure
```

## Loader: File Transformation

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: "vue-loader", // .vue file → JS module
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader", // TypeScript → JS
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader", // 3. Inject CSS into the DOM
          "css-loader", // 2. Handle @import and url()
          "sass-loader", // 1. SCSS → CSS (executed right to left)
        ],
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 8192, // < 8 KB → convert to base64
          },
        },
      },
    ],
  },
};
```

Loaders execute **right to left, bottom to top**:

```javascript
use: ["style-loader", "css-loader", "sass-loader"];
// Execution order: sass-loader → css-loader → style-loader
```

## Plugin: Build Enhancement

```javascript
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const webpack = require("webpack");

module.exports = {
  plugins: [
    // Auto-generate HTML and inject script tags
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "index.html",
    }),

    // Extract CSS into a separate file (instead of injecting via <style>)
    new MiniCssExtractPlugin({
      filename: "css/[name].[contenthash:8].css",
    }),

    // Visualise bundle size (enable only when needed)
    process.env.ANALYZE && new BundleAnalyzerPlugin(),

    // Define global constants
    new webpack.DefinePlugin({
      "process.env.API_URL": JSON.stringify(process.env.API_URL),
    }),
  ].filter(Boolean),
};
```

## Writing a Simple Loader

```javascript
// my-loader.js
module.exports = function (source) {
  // source: the raw file content (string)
  // return: the transformed content

  // Example: strip all console.log calls from the file
  return source.replace(/console\.log\(.*?\);?\n?/g, "");
};
```

## Writing a Simple Plugin

```javascript
class BuildTimePlugin {
  apply(compiler) {
    // Listen for the done (build complete) event
    compiler.hooks.done.tap("BuildTimePlugin", (stats) => {
      const time = stats.endTime - stats.startTime;
      console.log(`\nBuild time: ${time}ms\n`);
    });
  }
}

module.exports = BuildTimePlugin;
```

## Summary

|                 | Loader                  | Plugin                                                            |
| --------------- | ----------------------- | ----------------------------------------------------------------- |
| Scope           | Individual file         | Entire build pipeline                                             |
| Trigger         | When a file is imported | Webpack lifecycle hooks                                           |
| Config location | `module.rules`          | `plugins` array                                                   |
| Typical use     | File type conversion    | Minification, code splitting, HTML generation, variable injection |
