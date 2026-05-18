---
title: "Webpack 公共程式碼提取和 SplitChunks"
date: 2018-10-25 10:34:15
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "隨著專案頁面增多，多個頁面都用到的程式碼會被重複打包。`SplitChunks` 可以把公共程式碼提取出來，讓瀏覽器快取複用。"
---

隨著專案頁面增多，多個頁面都用到的程式碼會被重複打包。`SplitChunks` 可以把公共程式碼提取出來，讓瀏覽器快取複用。

## 為什麼需要程式碼分割

```
專案有 A、B、C 三個頁面，都用了 lodash 和 Vue
如果不提取：
  pageA.js = pageA程式碼 + lodash + Vue
  pageB.js = pageB程式碼 + lodash + Vue
  pageC.js = pageC程式碼 + lodash + Vue
  → lodash 和 Vue 被下載了 3 次！

提取後：
  vendor.js = lodash + Vue（只下載一次，長期快取）
  common.js = A/B/C 共用的業務程式碼
  pageA.js = pageA 自己的程式碼（很小）
```

## Webpack 4 的 SplitChunks

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // 對所有 chunks 生效（async/initial/all）

      cacheGroups: {
        // 第三方庫單獨打包
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 20,
        },

        // 公共業務程式碼
        common: {
          name: "common",
          minChunks: 2, // 至少被 2 個 chunk 引用
          chunks: "all",
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

## 更細粒度的分割

```javascript
cacheGroups: {
  // Vue 框架單獨打包（很少變化，長期快取）
  vue: {
    test: /[\\/]node_modules[\\/](vue|vue-router|vuex)[\\/]/,
    name: 'vue',
    chunks: 'all',
    priority: 30
  },

  // Element UI 單獨打包（比較大，單獨快取）
  elementUI: {
    test: /[\\/]node_modules[\\/]element-ui[\\/]/,
    name: 'element-ui',
    chunks: 'all',
    priority: 25
  },

  // 其他第三方庫
  vendors: {
    test: /[\\/]node_modules[\\/]/,
    name: 'vendors',
    chunks: 'all',
    priority: 20
  },

  // 專案公共程式碼
  common: {
    name: 'common',
    minChunks: 2,
    chunks: 'all',
    priority: 10
  }
}
```

## runtime chunk

```javascript
optimization: {
  // 把 webpack 的執行時程式碼單獨提取
  // 避免 vendor hash 因為 runtime 變化而改變
  runtimeChunk: {
    name: "runtime";
  }
}
```

## 快取策略配合

```javascript
output: {
  // contenthash：內容不變則 hash 不變，瀏覽器可以長期快取
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

分割策略：

```
runtime.js    → 很小，每次構建可能變化
vendor.js     → 第三方庫，幾乎不變，長期快取
common.js     → 業務公共程式碼，偶爾變化
pageA.js      → 頁面程式碼，經常變化
```

## Vue CLI 的預設配置

Vue CLI 已經做了合理的預設配置，通常不需要手動改：

```javascript
// vue.config.js（只在預設不滿足需求時調整）
module.exports = {
  chainWebpack(config) {
    config.optimization.splitChunks({
      cacheGroups: {
        vendors: {
          name: "chunk-vendors",
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: "initial",
        },
      },
    });
  },
};
```

## 效果

在我們的專案裡，分割最佳化後：

```
最佳化前：
  app.js：1.2MB（首次和後續每頁都要下載）

最佳化後：
  vendor.js：600KB（首次下載，後續所有頁面快取複用）
  common.js：100KB
  各頁面 chunk：30-80KB

首次總量差不多，但後續頁面跳轉只需要下載 page chunk
```

## 小結

- `splitChunks.chunks: 'all'` 對所有程式碼生效
- `cacheGroups` 定義不同的提取策略
- 第三方庫按頻率分組：核心框架、大型UI庫、其他
- `contenthash` 確保快取在內容不變時有效
- Vue CLI 有合理預設值，先跑 bundle analyzer 再決定要不要調整
