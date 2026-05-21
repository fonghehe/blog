---
title: "Introduction to TypeScript Generics"
date: 2019-04-18 10:16:18
tags:
  - TypeScript
readingTime: 1
description: "There are plenty of articles on TypeScript generics online, but most lack real-world experience. This article explores best practices based on actual projects."
wordCount: 84
---

There are plenty of articles on TypeScript generics online, but most lack real-world experience. This article explores best practices based on actual projects.

## Quick Start

Here is a practical example:

```javascript
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash:8].js",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
        },
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({ template: "./src/index.html" }),
    new MiniCssExtractPlugin({ filename: "[name].css" }),
  ],
};
```

After rolling this pattern out across the team, the results were great — maintenance costs dropped noticeably.

## Advanced Usage

This can be implemented as follows:

```javascript
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sum calculates correctly', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounce delays execution', () => {
    jest.useFakeTimers()
    const fn = jest.fn()
    const debounced = debounce(fn, 300)

    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()
```

Generics let you write reusable, type-safe code. The key insight is that **types are parameters** — just like functions accept value parameters, generic functions and interfaces accept type parameters.
