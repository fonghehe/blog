---
title: "前端構建工具統一化趨勢"
date: 2021-05-12 10:39:03
tags:
  - 前端
  - 工程化
readingTime: 2
description: "最近在團隊中落地前端構建工具統一化趨勢，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。"
---

最近在團隊中落地前端構建工具統一化趨勢，積累了不少經驗。整理出來供參考，希望對做類似工作的同學有所幫助。

## 核心概念

先來看基本的實現方式：

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

這段程式碼展示了基本的使用方式。實際專案中還需要考慮錯誤處理和邊界條件。

## 深度解析

在這個基礎上，我們可以進一步最佳化：

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

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 落地經驗

實際專案中的用法會更復雜一些：

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

通過這種方式，程式碼的可測試性和可擴充套件性都得到了提升。

## 調優策略

以下是一個完整的示例：

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

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- 程式碼示例僅供參考，需根據業務場景調整
- 前端構建工具統一化趨勢不是銀彈，需要根據專案規模和技術棧選擇
- 理解底層原理比記住 API 更重要