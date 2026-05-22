---
title: "Rspack 2.0 New Features and Ecosystem"
date: 2025-02-17 09:51:28
tags:
  - Frontend
readingTime: 1
description: "When it comes to Rspack 2.0 New Features and Ecosystem, many developers only scratch the surface at the API call level. This article attempts to discuss the rea"
wordCount: 111
---

When it comes to Rspack 2.0 New Features and Ecosystem, many developers only scratch the surface at the API call level. This article attempts to discuss the real-world problems and solutions you'll encounter from a production environment perspective.

## Basic Principles

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

## Advanced Features

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

## Project Practice

In real projects, the usage gets more complex:

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

Through this approach, both testability and scalability of the code are improved.
