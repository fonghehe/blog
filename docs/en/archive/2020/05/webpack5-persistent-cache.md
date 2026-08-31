---
title: "Webpack 5 Persistent Cache for Faster Builds"
date: 2020-05-01 09:53:04
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "We recently adopted Webpack 5's persistent cache for faster builds on our team and gained valuable experience. I'm sharing it here as a reference for anyone doing similar work."
wordCount: 170
---

We recently rolled out Webpack 5's persistent cache for faster builds on our team and picked up a fair bit of experience along the way. I'm sharing it here in case it helps anyone doing similar work.

## Core Concepts

Let's first look at the basic implementation:

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'vuex'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})
```

This snippet shows the basic usage. In a real project you'd also need to account for error handling and edge cases.

## In-Depth Analysis

Building on this, we can optimize further:

```javascript
module.exports = {
  entry: './src/index.js',
  output: { path: __dirname + '/dist', filename: '[name].[contenthash:8].js' },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors' }
      }
    }
  }
}
```

This pattern is very practical in large projects and can significantly reduce maintenance cost.

## Implementation Experience

In real projects, the actual usage tends to be a bit more involved:

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'vuex'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})
```

This approach improves both the testability and the extensibility of the code.

## Tuning Strategy

Here is a complete example:

```javascript
module.exports = {
  entry: './src/index.js',
  output: { path: __dirname + '/dist', filename: '[name].[contenthash:8].js' },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors' }
      }
    }
  }
}
```

Pay close attention to edge-case handling—this is critical in production.

## Summary

- Always verify browser compatibility before using it in production.
- In team collaboration, conventions and documentation matter more than the technology itself.
- Keep an eye on what's happening in the community—technical solutions need to keep iterating.
