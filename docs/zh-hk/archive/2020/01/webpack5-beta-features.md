---
title: "Webpack 5 Beta 新特性：Module Federation 與持久緩存"
date: 2020-01-20 16:34:10
tags:
  - Webpack
  - 工程化
readingTime: 3
description: "Webpack 5 還在 Beta 階段，但社區討論已經很熱了。花了一週時間試了兩個最重要的新特性：Module Federation 和持久緩存。記錄一下心得。"
wordCount: 375
---

Webpack 5 還在 Beta 階段，但社區討論已經很熱了。花了一週時間試了兩個最重要的新特性：Module Federation 和持久緩存。記錄一下心得。

## 持久緩存 (Persistent Cache)

這是最讓我興奮的特性。目前我們項目冷啓動 Webpack 要 60 秒以上，用上持久緩存後體驗完全不同。

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  cache: {
    type: 'filesystem',  // 關鍵：使用文件系統緩存

    // 緩存配置
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),

    // 構建依賴：這些文件變化時緩存失效
    buildDependencies: {
      config: [__filename],  // webpack 配置變化時清緩存
    },

    // 緩存名稱（多配置時區分）
    name: `${process.env.NODE_ENV || 'development'}-cache`,

    // 版本號：手動控製緩存失效
    version: '1.0.0',
  },

  // 其他配置...
};
```

**實測效果：**

```
第一次構建（冷啓動）:  58s   ← 和以前一樣
第二次構建（熱緩存）:   4s   ← 快了 10 倍以上
第三次構建（改了業務代碼）: 6s   ← 隻重編譯改動的模塊

對比：
  - Webpack 4 + hard-source-webpack-plugin：約 15s（還經常出 bug）
  - Webpack 5 filesystem cache：4s（原生支持，穩定）
```

**原理：**

```
Webpack 4 的問題：
  每次構建都要完整解析所有模塊 → AST → 生成代碼
  hard-source 插件是社區方案，不夠穩定

Webpack 5 的做法：
  - 將模塊的編譯結果（包括 AST）緩存到文件系統
  - 下次構建時，如果模塊文件和配置都沒變，直接用緩存
  - 增量構建時，隻重新編譯變化的模塊
```

**注意事項：**

```javascript
// 1. loader 必須支持緩存
// 大多數主流 loader 已經支持了
// 如果自定義 loader，要實現 cacheable：
module.exports = function(source) {
  this.cacheable(true);  // 聲明可緩存
  // ...
  return source;
};

// 2. 緩存目錄要加入 .gitignore
// .gitignore
// .webpack_cache/

// 3. CI 環境可以持久化緩存目錄
// .gitlab-ci.yml
// cache:
//   paths:
//     - .webpack_cache/
```

## Module Federation

這個特性是 Zack Jackson 提出的，核心思路是：**讓不同的 Webpack 構建產物可以互相引用模塊**。

通俗地説：你可以讓一個應用在運行時，去加載另一個應用的代碼，就像加載本地模塊一樣。

### 基本概念

```
傳統微前端的問題：
  - iframe：隔離太重，通信麻煩
  - single-spa：需要統一框架版本，共享複雜

Module Federation 的做法：
  - 每個應用獨立構建、獨立部署
  - 運行時按需加載遠程模塊
  - 共享依賴（React/Vue 隻加載一份）
```

### 設定示例

```javascript
// app-shell/webpack.config.js  （主應用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'appShell',
      filename: 'remoteEntry.js',

      // 消費遠程模塊
      remotes: {
        // 從 remoteApp 加載模塊
        remoteApp: 'remoteApp@http://localhost:3001/remoteEntry.js',
        // 可以有多個遠程源
        dashboard: 'dashboard@http://localhost:3002/remoteEntry.js',
      },

      // 共享依賴：避免重複加載
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
// remote-app/webpack.config.js  （遠程應用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'remoteApp',
      filename: 'remoteEntry.js',

      // 暴露模塊給其他應用使用
      exposes: {
        // 暴露整個組件
        './UserCard': './src/components/UserCard.vue',
        // 暴露工具函數
        './utils': './src/utils/index.ts',
        // 暴露路由配置
        './routes': './src/router/routes.ts',
      },

      // 同樣聲明共享依賴
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
        'vue-router': { singleton: true },
      },
    }),
  ],
};
```

### 在主應用中使用遠程模塊

```vue
<!-- app-shell/src/views/Dashboard.vue -->
<template>
  <div>
    <h1>主應用 Dashboard</h1>
    <!-- 直接使用遠程組件 -->
    <RemoteUserCard :user="currentUser" />
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue';

export default {
  components: {
    // 動態加載遠程組件
    RemoteUserCard: defineAsyncComponent(() =>
      import('remoteApp/UserCard')
    ),
  },
};
</script>
```

```javascript
// 也可以在路由中使用遠程模塊
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
    singleton: true,          // 隻加載一個版本
    requiredVersion: '^3.0.0', // 版本要求
    eager: false,              // false = 懶加載（推薦）
    // eager: true 會打包進 bundle，失去按需加載優勢
  },

  // 方式 3：自動共享 package.json 的所有 dependencies
  ...require('./package.json').dependencies,
}
```

## Asset Modules（替代 file-loader/url-loader）

Webpack 5 內置了資源處理，不再需要安裝額外的 loader。

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      // 替代 file-loader
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset/resource',  // 輸出單獨文件
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
        type: 'asset/source',    // 導出源碼字符串
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

// 3. 內置的模塊解析更智能
resolve: {
  // 支持 exports map（package.json 的 exports 字段）
  exportsFields: ['exports'],
  // 條件導出
  conditionNames: ['import', 'module', 'default'],
}
```

## 升級計劃

我們目前的策略是：**不急着升**。

```
原因：
  - Webpack 5 還是 Beta，API 可能變化
  - 部分 loader/plugin 還沒適配（如 vue-loader 的某些版本）
  - 我們的項目已經很大，遷移成本高

計劃：
  2020 Q1：在新項目中試用 Webpack 5
  2020 Q2：評估穩定性，準備主項目遷移方案
  2020 Q3-Q4：視 Webpack 5 正式版發佈情況決定
```

## 小結

- 持久緩存是 Webpack 5 最實用的特性，能將二次構建時間降低一個數量級
- Module Federation 是微前端的新思路，運行時模塊共享比 iframe 和 single-spa 更優雅
- Asset Modules 簡化了資源設定，不再需要 file-loader / url-loader
- Webpack 5 目前還是 Beta，生產項目建議等正式版再升級
- 配合 Vite 等新工具的出現，2020 年構建工具領域會有很大變化
