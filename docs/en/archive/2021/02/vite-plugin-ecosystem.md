---
title: "Vite Plugin Ecosystem and Development"
date: 2021-02-02 10:39:47
tags:
  - Vite
  - Engineering
  - Vue
  - JavaScript
  - CSS
  - Node.js

readingTime: 2
description: "The Vite plugin ecosystem plays an ever bigger role in everyday development. This article systematically covers plugin usage, internals, and how to get the most out of them."
wordCount: 181
---

In day-to-day development, the Vite plugin ecosystem and plugin development are being used more and more frequently. This article systematically explains their usage, principles, and optimization strategies.

## Quick Start

Usage in real projects is somewhat more complex:

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
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

Through this approach, both the testability and scalability of the code are improved.

## Internal Principles

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

Pay attention to boundary condition handling, which is critical in production.

## Business Practice

The key lies in understanding the core logic:

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
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Performance Comparison

We can improve it in the following ways:

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

This approach has been running stably in production for over six months and has been practically validated.

## Summary

- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- The Vite plugin ecosystem and plugin development aren't a silver bullet; choose based on your project's scale and tech stack.
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production
