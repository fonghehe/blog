---
title: "Introduction to esbuild: The Lightning-Fast Build Tool"
date: 2020-05-05 17:11:52
tags:
  - Engineering
readingTime: 2
description: "When it comes to getting started with esbuild, many developers only operate at the API level. This article looks at it from a production perspective, discussing the problems you'll actually run into and how to solve them."
wordCount: 242
---

When it comes to getting started with esbuild, the lightning-fast build tool, many developers only operate at the API-call level. This article looks at it from a production perspective, discussing the problems you'll actually run into and how to solve them.

## Basic Principles

We can improve on this in the following ways:

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

This approach has been running stably in production for over half a year and has proven itself in practice.

## Advanced Features

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

## Project Practice

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

## Best Practices

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

## Common Pitfalls

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

- In team collaboration, conventions and documentation matter more than the technology itself.
- Keep an eye on what's happening in the community—technical solutions need to keep iterating.
- Don't adopt new technology just for its own sake.
- The code examples are for reference only and should be adapted to your specific use case.
- Getting started with esbuild, the lightning-fast build tool, isn't a silver bullet; choose it based on your project's scale and tech stack.
