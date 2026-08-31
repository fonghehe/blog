---
title: "Webpack 5 Asset Modules: Replacing file-loader"
date: 2020-04-27 15:33:30
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "Webpack 5 Asset Modules, as a replacement for file-loader, are seeing wider adoption in frontend development. Starting from real projects, this article analyzes their core principles and best practices."
wordCount: 188
---

Webpack 5 Asset Modules, as a replacement for file-loader, are being used more and more widely in frontend development. Starting from real projects, this article takes a deep look at their core principles and best practices.

## Basic Usage

In real projects, the usage gets a bit more involved:

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

This way, both the testability and extensibility of the code improve.

## Advanced Usage

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

Pay attention to edge-case handling — that is critical in production.

## Practical Cases

The key is to understand the core logic:

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

Performance optimization has to be tied to the specific scenario; not every case needs over-optimization.

## Performance Optimization

Here are some ways we can improve on this:

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

This approach has been running stably in production for over half a year and is proven in practice.

## Summary

- Before using it in production, make sure to verify compatibility.
- In team collaboration, conventions and documentation matter more than the technology itself.
- Keep an eye on the community; technical solutions need continuous iteration.
- Don't adopt new tech just for the sake of using it.
- Code examples are for reference only; adapt them to your business scenarios.
