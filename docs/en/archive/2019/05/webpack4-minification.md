---
title: "Webpack 4 Code Minification and Optimization"
date: 2019-05-31 10:33:02
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "There are plenty of articles on Webpack 4 code minification and optimization online, but most lack real-world experience. This article explores best practices b"
---

There are plenty of articles on Webpack 4 code minification and optimization online, but most lack real-world experience. This article explores best practices based on actual projects.

## JavaScript Minification with Terser

Webpack 4's production mode uses TerserPlugin by default:

```javascript
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: "production",
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // remove console.log
            drop_debugger: true, // remove debugger statements
            pure_funcs: ["console.log"],
          },
          mangle: true, // mangle variable names
          output: {
            comments: false, // remove comments
          },
        },
        extractComments: false, // don't extract comments to separate file
      }),
    ],
  },
};
```

## CSS Minification

```javascript
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [new MiniCssExtractPlugin({ filename: "[name].[contenthash].css" })],
  optimization: {
    minimizer: [new CssMinimizerPlugin()],
  },
};
```

## Bundle Analysis

```bash
# Install the analyzer
npm install --save-dev webpack-bundle-analyzer

# Generate stats file
webpack --profile --json > stats.json

# Visualize
npx webpack-bundle-analyzer stats.json
```

```javascript
// Or use the plugin directly
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = {
  plugins: [process.env.ANALYZE && new BundleAnalyzerPlugin()].filter(Boolean),
};
```

Run `ANALYZE=true npm run build` to open a visual treemap of your bundle — this is the first step to finding optimization opportunities.
