---
title: "Webpack splitChunks 代碼分割實戰：落地路徑與實戰建議"
date: 2018-06-09 16:08:30
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 4 用 `splitChunks` 替代了之前的 `CommonsChunkPlugin`，設定更簡單。記錄一下實際項目裏的設定。"
wordCount: 269
---

Webpack 4 用 `splitChunks` 替代了之前的 `CommonsChunkPlugin`，配置更簡單。記錄一下實際項目裏的配置。

## 為什麼要代碼分割

不分割的情況下，所有代碼打成一個 `main.js`，用户每次訪問都需要加載整個檔案，即使大部分頁面他用不到。

代碼分割後：

- 公共庫（vue、lodash）單獨打包，利用瀏覽器緩存
- 路由對應的頁面按需加載
- 首屏隻加載必要代碼

## 路由懶加載（最簡單的分割）

```javascript
// router/index.js
const routes = [
  {
    path: "/dashboard",
    component: () =>
      import(/* webpackChunkName: "dashboard" */ "../views/Dashboard.vue"),
  },
  {
    path: "/users",
    component: () =>
      import(/* webpackChunkName: "users" */ "../views/Users.vue"),
  },
];
```

`/* webpackChunkName: "xxx" */` 註釋可以給分割出的 chunk 起名字，便於分析。

## splitChunks 設定

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // 對所有 chunk 生效（包括異步和同步）
      cacheGroups: {
        // 第三方依賴單獨打包
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
          chunks: "all",
        },
        // Element UI 單獨打包（體積大，變動少）
        elementUI: {
          test: /[\\/]node_modules[\\/]element-ui[\\/]/,
          name: "element-ui",
          priority: 20, // 優先級高於 vendors
          chunks: "all",
        },
        // 被多個 chunk 共用的代碼
        common: {
          minChunks: 2, // 至少被 2 個 chunk 引用
          name: "common",
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    // 運行時代碼單獨提取
    runtimeChunk: {
      name: "runtime",
    },
  },
};
```

## Vue CLI 3 中的設定

```javascript
// vue.config.js
module.exports = {
  chainWebpack: (config) => {
    config.optimization.splitChunks({
      chunks: "all",
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: -10,
          chunks: "all",
        },
      },
    });
  },
};
```

## 分析打包結果

安裝 `webpack-bundle-analyzer` 看看分割效果：

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  plugins: [new BundleAnalyzerPlugin()],
};
```

## HTML 中的 preload/prefetch

Vue CLI 3 會自動為懶加載的 chunk 生成 `<link rel="prefetch">` 標籤，瀏覽器空閒時預加載：

```html
<!-- 自動生成 -->
<link rel="prefetch" href="/js/dashboard.js" />
<link rel="prefetch" href="/js/users.js" />
```

## 小結

- 路由懶加載是最簡單的代碼分割方式，一行代碼
- `splitChunks.cacheGroups` 控製如何分組
- 第三方庫單獨打包，充分利用瀏覽器緩存
- 用 bundle analyzer 確認分割效果
