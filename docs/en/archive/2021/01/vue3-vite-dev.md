---
title: "Vite + Vue 3: Lightning-Fast Development Experience"
date: 2021-01-08 17:36:35
tags:
  - Vue
  - Vite
  - JavaScript
  - CSS
  - Node.js

readingTime: 1
description: "The Vite plus Vue 3 dev experience has been discussed many times in the community, but things move fast and many conclusions are outdated. This article revisits the topic against the latest versions."
wordCount: 168
---

The blazing-fast Vite + Vue 3 dev experience has been discussed many times in the community, but as versions iterate, many conclusions need updating. This article revisits the topic based on the latest version.

## Getting Started

Let's start with the basic implementation:

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('组件已挂载') })

    return { count, doubled }
  }
}

```

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Source Code Analysis

Building on this foundation, we can further optimize:

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

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Real-World Applications

In real projects the usage gets a bit more complex:

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

## Optimization Tips

Here is a complete example:

```javascript
import { reactive, toRefs, computed } from 'vue'

function useCounter(initial = 0) {
  const state = reactive({ count: initial, history: [initial] })
  const doubled = computed(() => state.count * 2)

  function increment() {
    state.count++
    state.history.push(state.count)
  }

  return { ...toRefs(state), doubled, increment }
}

```

Pay attention to boundary condition handling, which is critical in production.

## Summary

- The fast Vite + Vue 3 dev experience isn't a silver bullet; choose it based on your project's size and tech stack
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production
