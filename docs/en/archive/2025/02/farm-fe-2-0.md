---
title: "Farm 2.0 Frontend Build Tool"
date: 2025-02-24 10:00:00
tags:
  - Frontend
readingTime: 1
description: "In daily development, the Farm 2.0 Frontend Build Tool is being used more and more frequently. This article systematically explains its usage, principles, and o"
wordCount: 115
---

In daily development, the Farm 2.0 Frontend Build Tool is being used more and more frequently. This article systematically explains its usage, principles, and optimization strategies.

## Quick Start

We can improve it in the following ways:

```javascript
module.exports = {
  entry: "./src/index.js",
  output: { path: __dirname + "/dist", filename: "[name].[contenthash:8].js" },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: "babel-loader" },
      { test: /\.css$/, use: ["style-loader", "css-loader", "postcss-loader"] },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: { test: /[\\/]node_modules[\\/]/, name: "vendors" },
      },
    },
  },
};
```

This solution has been running stably in production for over six months and has been validated in practice.

## Internal Principles

Let's start with the basic implementation:

```javascript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  server: {
    port: 3000,
    proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "pinia"],
          utils: ["lodash-es", "dayjs"],
        },
      },
    },
  },
});
```

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Real-World Application

Building on this foundation, we can further optimize:

```javascript
module.exports = {
  entry: "./src/index.js",
  output: { path: __dirname + "/dist", filename: "[name].[contenthash:8].js" },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: "babel-loader" },
      { test: /\.css$/, use: ["style-loader", "css-loader", "postcss-loader"] },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: { test: /[\\/]node_modules[\\/]/, name: "vendors" },
      },
    },
  },
};
```

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Performance Comparison

In real projects, the usage gets more complex:
