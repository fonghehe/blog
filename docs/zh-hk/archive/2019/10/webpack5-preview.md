---
title: "Webpack 5 新特性預覽 Module Federation：特性解讀與遷移建議"
date: 2019-10-14 16:20:40
tags:
  - Webpack
  - 工程化
readingTime: 4
description: "Webpack 5 目前仍處於 Beta 階段，但它帶來了許多令人興奮的改進。其中最值得關注的是 Module Federation——它徹底改變了前端微服務的實現方式。本文將介紹 Webpack 5 的核心新特性，並重點探討 Module Federation 的工作原理。"
wordCount: 729
---

Webpack 5 目前仍處於 Beta 階段，但它帶來了許多令人興奮的改進。其中最值得關注的是 Module Federation——它徹底改變了前端微服務的實現方式。本文將介紹 Webpack 5 的核心新特性，並重點探討 Module Federation 的工作原理。

## Webpack 5 整體改進概覽

Webpack 5 的改進主要集中在以下幾個方面：

### 長期緩存優化

Webpack 5 改進了模塊 ID 和 chunk ID 的確定性算法：

```js
// webpack.config.js
module.exports = {
  // 使用確定性的模塊 ID，避免模塊 ID 變化導致緩存失效
  optimization: {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
  },
};
```

新增 `chunkIds` 和 `moduleIds` 選項：

- `'natural'`：按使用順序的數字 ID
- `'named'`：可讀的模塊名稱（開發用）
- `'deterministic'`：短數字 ID，構建間穩定（生產用）

### 持久化緩存

Webpack 5 內置了文件系統緩存，替代了 `hard-source-webpack-plugin`：

```js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],  // 配置文件變化時緩存失效
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
};
```

實測效果：

```
# 首次構建
webpack 5.0.0-beta.16 compiled successfully in 8342ms

# 二次構建（緩存命中）
webpack 5.0.0-beta.16 compiled successfully in 1203ms
```

### 更好的 Tree Shaking

Webpack 5 引入了嵌套 Tree Shaking 和內部模塊 Tree Shaking：

```js
// package.json
{
  "sideEffects": false  // 標記整個包無副作用
}

// 或者指定有副作用的文件
{
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

Webpack 5 還支持 CommonJS 的 Tree Shaking：

```js
// 這種寫法在 Webpack 5 中也能被 Tree Shaking
const { get } = require('lodash');
// 隻會打包 lodash.get，而不是整個 lodash
```

### 模塊聯邦（Module Federation）

這是 Webpack 5 最具革命性的特性，允許在運行時動態加載其他獨立構建的模塊。

## Module Federation 深入理解

### 核心概念

Module Federation 的核心思想是：每個構建產物（bundle）既可以消費遠程模塊，也可以暴露自己的模塊供其他構建產物使用。

關鍵術語：

- **Host**：消費遠程模塊的構建
- **Remote**：暴露模塊供其他構建使用的構建
- **Shared**：多個構建之間共享的依賴

### 基礎設定

假設有兩個獨立的前端應用：`app-shell`（主應用）和 `dashboard`（儀表盤應用）。

**dashboard 應用（Remote）暴露模塊：**

```js
// dashboard/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index.js',
  output: {
    publicPath: 'http://localhost:3001/',
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'dashboard',
      filename: 'remoteEntry.js',
      exposes: {
        // 暴露模塊路徑：模塊名
        './Widget': './src/components/Widget',
        './Chart': './src/components/Chart',
        './useDashboard': './src/hooks/useDashboard',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^16.8.0' },
        'react-dom': { singleton: true, requiredVersion: '^16.8.0' },
      },
    }),
  ],
};
```

**app-shell 應用（Host）消費模塊：**

```js
// app-shell/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index.js',
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_shell',
      remotes: {
        // 遠程模塊名: 遠程容器變量名@入口地址
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^16.8.0' },
        'react-dom': { singleton: true, requiredVersion: '^16.8.0' },
      },
    }),
  ],
};
```

### 在代碼中使用遠程模塊

```jsx
// app-shell/src/App.jsx
import React, { Suspense, lazy } from 'react';

// 動態導入遠程模塊
const Widget = lazy(() => import('dashboard/Widget'));
const Chart = lazy(() => import('dashboard/Chart'));

function App() {
  return (
    <div>
      <h1>應用外殼</h1>
      <Suspense fallback={<div>加載儀表盤組件...</div>}>
        <Widget title="用户統計" />
        <Chart type="line" data={chartData} />
      </Suspense>
    </div>
  );
}

export default App;
```

### 共享依賴的設定

Shared 設定控製多個構建之間的依賴共享方式：

```js
new ModuleFederationPlugin({
  shared: {
    react: {
      singleton: true,       // 隻加載一個實例
      requiredVersion: '^16.8.0',
      eager: false,          // 懶加載（默認），不打包到入口 chunk
    },
    'react-dom': {
      singleton: true,
      requiredVersion: '^16.8.0',
    },
    // 可以使用通配符
    lodash: {
      singleton: false,      // 允許多個版本共存
    },
  },
});
```

配置選項説明：

| 選項 | 説明 | 默認值 |
|
------|------|--------|
| `singleton` | 隻加載一個實例 | false |
| `requiredVersion` | 版本要求 | package.json 中的版本 |
| `eager` | 是否打包到入口 chunk | false |
| `strictVersion` | 版本不匹配時是否報錯 | true |

### 多 Remote 設定

一個應用可以同時消費多個 Remote：

```js
new ModuleFederationPlugin({
  name: 'host',
  remotes: {
    dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
    checkout: 'checkout@http://localhost:3002/remoteEntry.js',
    auth: 'auth@http://localhost:3003/remoteEntry.js',
  },
});
```

### 動態加載 Remote

如果 Remote 地址是動態的，可以這樣配置：

```js
// 在運行時動態加載遠程模塊
async function loadRemoteModule(url, scope, module) {
  // 加載遠程入口腳本
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  // 初始化共享作用域
  await __webpack_init_sharing__('default');

  // 獲取遠程容器
  const container = window[scope];
  await container.init(__webpack_share_scopes__.default);

  // 獲取遠程模塊
  const factory = await container.get(module);
  return factory();
}

// 使用
const Widget = await loadRemoteModule(
  'http://localhost:3001/remoteEntry.js',
  'dashboard',
  './Widget'
);
```

## 實際架構方案

### 微前端架構

Module Federation 非常適合構建微前端架構：

```
┌─────────────────────────────────────────────┐
│               App Shell (Host)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Dashboard │ │  Orders  │ │  User Center │ │
│  │ (Remote)  │ │ (Remote) │ │   (Remote)   │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│              共享: React, React DOM          │
└─────────────────────────────────────────────┘
```

每個團隊可以獨立開發、獨立部署自己的 Remote 模塊，App Shell 負責組裝。

### 組件庫共享

多個項目可以共享組件庫而不需要發佈 npm 包：

```js
// shared-ui/webpack.config.js
new ModuleFederationPlugin({
  name: 'shared_ui',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/Button',
    './Modal': './src/Modal',
    './Table': './src/Table',
    './theme': './src/theme',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
```

## 小結

- Webpack 5 的核心改進：持久化緩存、確定性模塊 ID、更好的 Tree Shaking
- Module Federation 允許獨立構建的應用在運行時共享模塊
- Host 消費遠程模塊，Remote 暴露模塊，Shared 控製依賴共享
- `singleton: true` 確保共享依賴隻加載一個實例
- 非常適合微前端架構和跨項目組件共享
- 支持動態加載和多 Remote 配置
- 預計 Webpack 5 正式版將在近期發佈
