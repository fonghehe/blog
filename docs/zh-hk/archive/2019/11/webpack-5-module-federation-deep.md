---
title: "Webpack 5 Module Federation 深入"
date: 2019-11-06 11:20:08
tags:
  - Webpack
  - 工程化
readingTime: 5
description: "在上一篇文章中我們預覽了 Webpack 5 的新特性，其中 Module Federation 是最具革命性的功能。本文將深入探討 Module Federation 的架構設計、配置細節和在微前端場景中的實戰應用。"
wordCount: 652
---

在上一篇文章中我們預覽了 Webpack 5 的新特性，其中 Module Federation 是最具革命性的功能。本文將深入探討 Module Federation 的架構設計、配置細節和在微前端場景中的實戰應用。

## Module Federation 的核心思想

Module Federation 允許一個 JavaScript 應用在運行時動態加載另一個應用暴露的模塊，而不需要在構建時就確定依賴關係。這意味着：

1. 每個應用獨立構建、獨立部署
2. 共享代碼不需要發佈為 npm 包
3. 依賴可以跨應用共享，避免重複加載

## 核心概念詳解

### Host 與 Remote

```
┌──────────────────┐         ┌──────────────────┐
│   Host (消費者)    │ ──────> │   Remote (提供者)  │
│                  │  運行時   │                  │
│  import('remote/ │  加載     │  exposes: {      │
│    Component')   │         │    './Component'  │
│                  │         │  }               │
└──────────────────┘         └──────────────────┘
```

- **Host**：消費遠程模塊的應用，通過 `remotes` 配置指定遠程模塊來源
- **Remote**：暴露模塊供其他應用使用，通過 `exposes` 配置暴露哪些模塊
- 一個應用可以同時是 Host 和 Remote

### 容器（Container）與入口（Entry）

每個配置了 ModuleFederationPlugin 的應用構建後會產生一個 `remoteEntry.js` 文件，它是遠程容器的入口：

```
dashboard/
├── dist/
│   ├── remoteEntry.js       ← 容器入口
│   ├── main.js
│   └── vendors.js
```

Host 應用通過加載這個 `remoteEntry.js` 來初始化遠程容器。

## 詳細配置

### Remote 端配置

```js
// dashboard/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    publicPath: 'http://localhost:3001/',
  },
  devServer: {
    port: 3001,
  },
  plugins: [
    new ModuleFederationPlugin({
      // 容器名稱，必須是有效的 JS 標識符
      name: 'dashboard',

      // 容器入口文件名
      filename: 'remoteEntry.js',

      // 暴露的模塊
      exposes: {
        './Widget': './src/components/Widget',
        './Chart': './src/components/Chart',
        './hooks': './src/hooks/index',
        './utils': './src/utils',
      },

      // 共享依賴
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^16.8.0',
          eager: false,
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^16.8.0',
          eager: false,
        },
        // 簡寫形式
        'react-router-dom': { singleton: true },
        antd: { singleton: true },
      },
    }),
  ],
};
```

### Host 端配置

```js
// main-app/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  plugins: [
    new ModuleFederationPlugin({
      name: 'main_app',
      remotes: {
        // key: 模塊名（代碼中 import 使用的名稱）
        // value: 容器名@入口地址
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
        checkout: 'checkout@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^16.8.0' },
        'react-dom': { singleton: true, requiredVersion: '^16.8.0' },
      },
    }),
  ],
};
```

### 在 Host 中使用 Remote 模塊

```jsx
// main-app/src/App.jsx
import React, { Suspense, lazy } from 'react';

// 動態導入 Remote 模塊
const DashboardWidget = lazy(() => import('dashboard/Widget'));
const DashboardChart = lazy(() => import('dashboard/Chart'));
const CheckoutForm = lazy(() => import('checkout/CheckoutForm'));

function App() {
  return (
    <div className="app">
      <nav>
        <a href="/dashboard">儀表盤</a>
        <a href="/checkout">結賬</a>
      </nav>

      <main>
        <Suspense fallback={<div>加載中...</div>}>
          <Route path="/dashboard">
            <div>
              <DashboardWidget title="用户統計" />
              <DashboardChart type="bar" />
            </div>
          </Route>
          <Route path="/checkout">
            <CheckoutForm />
          </Route>
        </Suspense>
      </main>
    </div>
  );
}
```

## 共享依賴詳解

Shared 配置控制依賴如何在 Host 和 Remote 之間共享：

```js
shared: {
  react: {
    // singleton: true 確保只加載一個 React 實例
    // 如果 Host 和 Remote 的 React 版本不兼容，會加載兩個實例（non-singleton）
    singleton: true,

    // 版本要求，語義化版本範圍
    requiredVersion: '^16.8.0',

    // eager: true 將依賴打包到入口 chunk 而不是懶加載
    // 適用於需要在模塊加載前就使用的場景（如 polyfills）
    eager: false,

    // strictVersion: true 版本不匹配時報錯，false 則加載多個版本
    strictVersion: true,
  },
}
```

### 版本協商機制

當 Host 和 Remote 共享同一個依賴時，Webpack 會進行版本協商：

```
Host: react@16.12.0
Remote: react@16.10.0
requiredVersion: ^16.8.0

兩個版本都滿足 ^16.8.0，所以：
- 如果 singleton: true → 使用 Host 的 react@16.12.0
- 如果 singleton: false → 各自使用各自的版本
```

如果版本不兼容：

```
Host: react@16.12.0
Remote: react@17.0.0（假設）
requiredVersion: ^16.8.0

Remote 的 react@17.0.0 不滿足 ^16.8.0：
- 如果 strictVersion: true → 報錯
- 如果 strictVersion: false → Remote 使用自己的 react@17.0.0
```

## 動態加載 Remote

在某些場景下，Remote 地址是動態的（比如從配置中心獲取）：

```js
// remote-loader.js
async function loadRemoteModule(url, scope, module) {
  // 步驟1: 加載遠程容器腳本
  await new Promise((resolve, reject) => {
    const element = document.createElement('script');
    element.src = url;
    element.type = 'text/javascript';
    element.async = true;
    element.onload = resolve;
    element.onerror = reject;
    document.head.appendChild(element);
  });

  // 步驟2: 初始化共享作用域
  await __webpack_init_sharing__('default');

  // 步驟3: 獲取並初始化遠程容器
  const container = window[scope];
  await container.init(__webpack_share_scopes__.default);

  // 步驟4: 獲取遠程模塊
  const factory = await container.get(module);
  const Module = factory();
  return Module;
}

// 使用
async function loadDashboard() {
  const config = await fetchRemoteConfig();
  const Widget = await loadRemoteModule(
    config.dashboard.url,
    'dashboard',
    './Widget'
  );
  return Widget;
}
```

## 實戰：微前端應用架構

### 項目結構

```
micro-frontend/
├── shell/                  # 主應用（Host）
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Router.jsx
│   │   └── bootstrap.js
│   └── webpack.config.js
├── apps/
│   ├── products/          # 商品應用（Remote + Host）
│   │   ├── src/
│   │   └── webpack.config.js
│   ├── orders/            # 訂單應用（Remote）
│   │   ├── src/
│   │   └── webpack.config.js
│   └── shared/            # 共享組件庫（Remote）
│       ├── src/
│       └── webpack.config.js
└── package.json
```

### Shell 主應用

```js
// shell/webpack.config.js
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    products: 'products@http://localhost:3001/remoteEntry.js',
    orders: 'orders@http://localhost:3002/remoteEntry.js',
    shared_lib: 'shared_lib@http://localhost:3003/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    'react-router-dom': { singleton: true },
  },
});
```

### Products 應用（既是 Remote 又是 Host）

```js
// products/webpack.config.js
new ModuleFederationPlugin({
  name: 'products',
  filename: 'remoteEntry.js',
  exposes: {
    './ProductList': './src/pages/ProductList',
    './ProductDetail': './src/pages/ProductDetail',
  },
  remotes: {
    shared_lib: 'shared_lib@http://localhost:3003/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    antd: { singleton: true },
  },
});
```

### 路由整合

```jsx
// shell/src/App.jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Switch, Route } from 'react-router-dom';

const ProductList = lazy(() => import('products/ProductList'));
const ProductDetail = lazy(() => import('products/ProductDetail'));
const OrderList = lazy(() => import('orders/OrderList'));

function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <nav className="sidebar">
          <a href="/products">商品管理</a>
          <a href="/orders">訂單管理</a>
        </nav>
        <main className="content">
          <Suspense fallback={<PageLoading />}>
            <Switch>
              <Route path="/products" exact component={ProductList} />
              <Route path="/products/:id" component={ProductDetail} />
              <Route path="/orders" component={OrderList} />
            </Switch>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

## 與其他微前端方案對比

| 特性 | Module Federation | qiankun | single-spa |
|
------|------------------|---------|------------|
| 隔離級別 | CSS 共享作用域 | JS/CSS 沙箱 | JS 沙箱 |
| 通信方式 | 直接 import | 全局狀態 | 自定義 |
| 依賴共享 | 內置版本協商 | 需要配置 | 需要 import maps |
| 構建要求 | 必須 Webpack 5 | 無要求 | 無要求 |
| 子應用加載 | 模塊級別 | 應用級別 | 應用級別 |

## 小結

- Module Federation 允許獨立構建的應用在運行時共享模塊
- Host 通過 `remotes` 配置消費遠程模塊，Remote 通過 `exposes` 暴露模塊
- `remoteEntry.js` 是遠程容器的入口文件
- `shared` 配置實現依賴共享，`singleton: true` 確保只加載一個實例
- 支持動態加載，適用於配置驅動的微前端架構
- 一個應用可以同時是 Host 和 Remote
- 與 qiankun 等方案相比，Module Federation 的優勢在於模塊級別的共享和內置的依賴協商
