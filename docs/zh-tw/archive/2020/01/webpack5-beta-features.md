---
title: "Webpack 5 Beta 新特性：Module Federation 與持久快取"
date: 2020-01-20 16:34:10
tags:
  - Webpack
  - 工程化
readingTime: 3
description: "Webpack 5 還在 Beta 階段，但社群討論已經很熱了。花了一週時間試了兩個最重要的新特性：Module Federation 和持久快取。記錄一下心得。"
---

Webpack 5 還在 Beta 階段，但社群討論已經很熱了。花了一週時間試了兩個最重要的新特性：Module Federation 和持久快取。記錄一下心得。

## 持久快取 (Persistent Cache)

這是最讓我興奮的特性。目前我們專案冷啟動 Webpack 要 60 秒以上，用上持久快取後體驗完全不同。

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  cache: {
    type: 'filesystem',  // 關鍵：使用檔案系統快取

    // 快取配置
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),

    // 構建依賴：這些檔案變化時快取失效
    buildDependencies: {
      config: [__filename],  // webpack 配置變化時清快取
    },

    // 快取名稱（多配置時區分）
    name: `${process.env.NODE_ENV || 'development'}-cache`,

    // 版本號：手動控制快取失效
    version: '1.0.0',
  },

  // 其他配置...
};
```

**實測效果：**

```
第一次構建（冷啟動）:  58s   ← 和以前一樣
第二次構建（熱快取）:   4s   ← 快了 10 倍以上
第三次構建（改了業務程式碼）: 6s   ← 只重編譯改動的模組

對比：
  - Webpack 4 + hard-source-webpack-plugin：約 15s（還經常出 bug）
  - Webpack 5 filesystem cache：4s（原生支援，穩定）
```

**原理：**

```
Webpack 4 的問題：
  每次構建都要完整解析所有模組 → AST → 生成程式碼
  hard-source 外掛是社群方案，不夠穩定

Webpack 5 的做法：
  - 將模組的編譯結果（包括 AST）快取到檔案系統
  - 下次構建時，如果模組檔案和配置都沒變，直接用快取
  - 增量構建時，只重新編譯變化的模組
```

**注意事項：**

```javascript
// 1. loader 必須支援快取
// 大多數主流 loader 已經支援了
// 如果自定義 loader，要實現 cacheable：
module.exports = function(source) {
  this.cacheable(true);  // 宣告可快取
  // ...
  return source;
};

// 2. 快取目錄要加入 .gitignore
// .gitignore
// .webpack_cache/

// 3. CI 環境可以持久化快取目錄
// .gitlab-ci.yml
// cache:
//   paths:
//     - .webpack_cache/
```

## Module Federation

這個特性是 Zack Jackson 提出的，核心思路是：**讓不同的 Webpack 構建產物可以互相引用模組**。

通俗地說：你可以讓一個應用在執行時，去載入另一個應用的程式碼，就像載入本地模組一樣。

### 基本概念

```
傳統微前端的問題：
  - iframe：隔離太重，通訊麻煩
  - single-spa：需要統一框架版本，共享複雜

Module Federation 的做法：
  - 每個應用獨立構建、獨立部署
  - 執行時按需載入遠端模組
  - 共享依賴（React/Vue 只加載一份）
```

### 配置示例

```javascript
// app-shell/webpack.config.js  （主應用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'appShell',
      filename: 'remoteEntry.js',

      // 消費遠端模組
      remotes: {
        // 從 remoteApp 載入模組
        remoteApp: 'remoteApp@http://localhost:3001/remoteEntry.js',
        // 可以有多個遠端源
        dashboard: 'dashboard@http://localhost:3002/remoteEntry.js',
      },

      // 共享依賴：避免重複載入
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
        'vue-router': { singleton: true },
        axios: { singleton: true },
      },
    }),
  ],
};
```

```javascript
// remote-app/webpack.config.js  （遠端應用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'remoteApp',
      filename: 'remoteEntry.js',

      // 暴露模組給其他應用使用
      exposes: {
        // 暴露整個元件
        './UserCard': './src/components/UserCard.vue',
        // 暴露工具函式
        './utils': './src/utils/index.ts',
        // 暴露路由配置
        './routes': './src/router/routes.ts',
      },

      // 同樣宣告共享依賴
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
        'vue-router': { singleton: true },
      },
    }),
  ],
};
```

### 在主應用中使用遠端模組

```vue
<!-- app-shell/src/views/Dashboard.vue -->
<template>
  <div>
    <h1>主應用 Dashboard</h1>
    <!-- 直接使用遠端元件 -->
    <RemoteUserCard :user="currentUser" />
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue';

export default {
  components: {
    // 動態載入遠端元件
    RemoteUserCard: defineAsyncComponent(() =>
      import('remoteApp/UserCard')
    ),
  },
};
</script>
```

```javascript
// 也可以在路由中使用遠端模組
const routes = [
  {
    path: '/users',
    component: () => import('remoteApp/UserManagement'),
  },
  {
    path: '/dashboard',
    component: () => import('dashboard/Dashboard'),
  },
];
```

### 共享依賴的策略

```javascript
shared: {
  // 方式 1：簡單共享
  vue: '^3.0.0',

  // 方式 2：詳細配置
  vue: {
    singleton: true,          // 只加載一個版本
    requiredVersion: '^3.0.0', // 版本要求
    eager: false,              // false = 懶載入（推薦）
    // eager: true 會打包進 bundle，失去按需載入優勢
  },

  // 方式 3：自動共享 package.json 的所有 dependencies
  ...require('./package.json').dependencies,
}
```

## Asset Modules（替代 file-loader/url-loader）

Webpack 5 內建了資源處理，不再需要安裝額外的 loader。

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      // 替代 file-loader
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset/resource',  // 輸出單獨檔案
      },

      // 替代 url-loader（小於 8KB 轉 base64）
      {
        test: /\.svg$/,
        type: 'asset',           // 自動選擇
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,   // 8KB 閾值
          },
        },
      },

      // 替代 raw-loader
      {
        test: /\.txt$/,
        type: 'asset/source',    // 匯出原始碼字串
      },
    ],
  },

  // 資源輸出配置
  output: {
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
  },
};
```

## 其他值得注意的變更

```javascript
// 1. 最低 Node.js 版本：10.13.0
// 2. 廢棄了一些舊特性

// Top-level this 不再指向 module.exports
// 以前：
this.foo = 'bar';  // 在 Webpack 4 中等同於 module.exports.foo
// Webpack 5：this 指向 undefined（嚴格模式）

// 3. 內建的模組解析更智慧
resolve: {
  // 支援 exports map（package.json 的 exports 欄位）
  exportsFields: ['exports'],
  // 條件匯出
  conditionNames: ['import', 'module', 'default'],
}
```

## 升級計劃

我們目前的策略是：**不急著升**。

```
原因：
  - Webpack 5 還是 Beta，API 可能變化
  - 部分 loader/plugin 還沒適配（如 vue-loader 的某些版本）
  - 我們的專案已經很大，遷移成本高

計劃：
  2020 Q1：在新專案中試用 Webpack 5
  2020 Q2：評估穩定性，準備主專案遷移方案
  2020 Q3-Q4：視 Webpack 5 正式版釋出情況決定
```

## 小結

- 持久快取是 Webpack 5 最實用的特性，能將二次構建時間降低一個數量級
- Module Federation 是微前端的新思路，執行時模組共享比 iframe 和 single-spa 更優雅
- Asset Modules 簡化了資源配置，不再需要 file-loader / url-loader
- Webpack 5 目前還是 Beta，生產專案建議等正式版再升級
- 配合 Vite 等新工具的出現，2020 年構建工具領域會有很大變化
