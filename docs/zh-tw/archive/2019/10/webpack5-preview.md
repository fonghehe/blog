---
title: "Webpack 5 新特性預覽 Module Federation"
date: 2019-10-14 16:20:40
tags:
  - Webpack
  - 工程化
readingTime: 4
description: "Webpack 5 目前仍處於 Beta 階段，但它帶來了許多令人興奮的改進。其中最值得關注的是 Module Federation——它徹底改變了前端微服務的實現方式。本文將介紹 Webpack 5 的核心新特性，並重點探討 Module Federation 的工作原理。"
---

Webpack 5 目前仍處於 Beta 階段，但它帶來了許多令人興奮的改進。其中最值得關注的是 Module Federation——它徹底改變了前端微服務的實現方式。本文將介紹 Webpack 5 的核心新特性，並重點探討 Module Federation 的工作原理。

## Webpack 5 整體改進概覽

Webpack 5 的改進主要集中在以下幾個方面：

### 長期快取最佳化

Webpack 5 改進了模組 ID 和 chunk ID 的確定性演算法：

```js
// webpack.config.js
module.exports = {
  // 使用確定性的模組 ID，避免模組 ID 變化導致快取失效
  optimization: {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
  },
};
```

新增 `chunkIds` 和 `moduleIds` 選項：

- `'natural'`：按使用順序的數字 ID
- `'named'`：可讀的模組名稱（開發用）
- `'deterministic'`：短數字 ID，構建間穩定（生產用）

### 持久化快取

Webpack 5 內建了檔案系統快取，替代了 `hard-source-webpack-plugin`：

```js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],  // 配置檔案變化時快取失效
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
};
```

實測效果：

```
# 首次構建
webpack 5.0.0-beta.16 compiled successfully in 8342ms

# 二次構建（快取命中）
webpack 5.0.0-beta.16 compiled successfully in 1203ms
```

### 更好的 Tree Shaking

Webpack 5 引入了巢狀 Tree Shaking 和內部模組 Tree Shaking：

```js
// package.json
{
  "sideEffects": false  // 標記整個包無副作用
}

// 或者指定有副作用的檔案
{
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

Webpack 5 還支援 CommonJS 的 Tree Shaking：

```js
// 這種寫法在 Webpack 5 中也能被 Tree Shaking
const { get } = require('lodash');
// 只會打包 lodash.get，而不是整個 lodash
```

### 模組聯邦（Module Federation）

這是 Webpack 5 最具革命性的特性，允許在執行時動態載入其他獨立構建的模組。

## Module Federation 深入理解

### 核心概念

Module Federation 的核心思想是：每個構建產物（bundle）既可以消費遠端模組，也可以暴露自己的模組供其他構建產物使用。

關鍵術語：

- **Host**：消費遠端模組的構建
- **Remote**：暴露模組供其他構建使用的構建
- **Shared**：多個構建之間共享的依賴

### 基礎配置

假設有兩個獨立的前端應用：`app-shell`（主應用）和 `dashboard`（儀表盤應用）。

**dashboard 應用（Remote）暴露模組：**

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
        // 暴露模組路徑：模組名
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

**app-shell 應用（Host）消費模組：**

```js
// app-shell/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index.js',
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_shell',
      remotes: {
        // 遠端模組名: 遠端容器變數名@入口地址
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

### 在程式碼中使用遠端模組

```jsx
// app-shell/src/App.jsx
import React, { Suspense, lazy } from 'react';

// 動態匯入遠端模組
const Widget = lazy(() => import('dashboard/Widget'));
const Chart = lazy(() => import('dashboard/Chart'));

function App() {
  return (
    <div>
      <h1>應用外殼</h1>
      <Suspense fallback={<div>載入儀表盤元件...</div>}>
        <Widget title="使用者統計" />
        <Chart type="line" data={chartData} />
      </Suspense>
    </div>
  );
}

export default App;
```

### 共享依賴的配置

Shared 配置控制多個構建之間的依賴共享方式：

```js
new ModuleFederationPlugin({
  shared: {
    react: {
      singleton: true,       // 只加載一個例項
      requiredVersion: '^16.8.0',
      eager: false,          // 懶載入（預設），不打包到入口 chunk
    },
    'react-dom': {
      singleton: true,
      requiredVersion: '^16.8.0',
    },
    // 可以使用萬用字元
    lodash: {
      singleton: false,      // 允許多個版本共存
    },
  },
});
```

配置選項說明：

| 選項 | 說明 | 預設值 |
|
------|------|--------|
| `singleton` | 只加載一個例項 | false |
| `requiredVersion` | 版本要求 | package.json 中的版本 |
| `eager` | 是否打包到入口 chunk | false |
| `strictVersion` | 版本不匹配時是否報錯 | true |

### 多 Remote 配置

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

### 動態載入 Remote

如果 Remote 地址是動態的，可以這樣配置：

```js
// 在執行時動態載入遠端模組
async function loadRemoteModule(url, scope, module) {
  // 載入遠端入口指令碼
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  // 初始化共享作用域
  await __webpack_init_sharing__('default');

  // 獲取遠端容器
  const container = window[scope];
  await container.init(__webpack_share_scopes__.default);

  // 獲取遠端模組
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

每個團隊可以獨立開發、獨立部署自己的 Remote 模組，App Shell 負責組裝。

### 元件庫共享

多個專案可以共享元件庫而不需要釋出 npm 包：

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

- Webpack 5 的核心改進：持久化快取、確定性模組 ID、更好的 Tree Shaking
- Module Federation 允許獨立構建的應用在執行時共享模組
- Host 消費遠端模組，Remote 暴露模組，Shared 控制依賴共享
- `singleton: true` 確保共享依賴只加載一個例項
- 非常適合微前端架構和跨專案元件共享
- 支援動態載入和多 Remote 配置
- 預計 Webpack 5 正式版將在近期釋出
