---
title: "Webpack 5 Module Federation 深入：微前端的下一个答案"
date: 2019-11-06 11:20:08
tags:
  - Webpack
  - 工程化
readingTime: 5
description: "在上一篇文章中我们预览了 Webpack 5 的新特性，其中 Module Federation 是最具革命性的功能。本文将深入探讨 Module Federation 的架构设计、配置细节和在微前端场景中的实战应用。"
wordCount: 652
---

在上一篇文章中我们预览了 Webpack 5 的新特性，其中 Module Federation 是最具革命性的功能。本文将深入探讨 Module Federation 的架构设计、配置细节和在微前端场景中的实战应用。

## Module Federation 的核心思想

Module Federation 允许一个 JavaScript 应用在运行时动态加载另一个应用暴露的模块，而不需要在构建时就确定依赖关系。这意味着：

1. 每个应用独立构建、独立部署
2. 共享代码不需要发布为 npm 包
3. 依赖可以跨应用共享，避免重复加载

## 核心概念详解

### Host 与 Remote

```
┌──────────────────┐         ┌──────────────────┐
│   Host (消费者)    │ ──────> │   Remote (提供者)  │
│                  │  运行时   │                  │
│  import('remote/ │  加载     │  exposes: {      │
│    Component')   │         │    './Component'  │
│                  │         │  }               │
└──────────────────┘         └──────────────────┘
```

- **Host**：消费远程模块的应用，通过 `remotes` 配置指定远程模块来源
- **Remote**：暴露模块供其他应用使用，通过 `exposes` 配置暴露哪些模块
- 一个应用可以同时是 Host 和 Remote

### 容器（Container）与入口（Entry）

每个配置了 ModuleFederationPlugin 的应用构建后会产生一个 `remoteEntry.js` 文件，它是远程容器的入口：

```
dashboard/
├── dist/
│   ├── remoteEntry.js       ← 容器入口
│   ├── main.js
│   └── vendors.js
```

Host 应用通过加载这个 `remoteEntry.js` 来初始化远程容器。

## 详细配置

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
      // 容器名称，必须是有效的 JS 标识符
      name: 'dashboard',

      // 容器入口文件名
      filename: 'remoteEntry.js',

      // 暴露的模块
      exposes: {
        './Widget': './src/components/Widget',
        './Chart': './src/components/Chart',
        './hooks': './src/hooks/index',
        './utils': './src/utils',
      },

      // 共享依赖
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
        // 简写形式
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
        // key: 模块名（代码中 import 使用的名称）
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

### 在 Host 中使用 Remote 模块

```jsx
// main-app/src/App.jsx
import React, { Suspense, lazy } from 'react';

// 动态导入 Remote 模块
const DashboardWidget = lazy(() => import('dashboard/Widget'));
const DashboardChart = lazy(() => import('dashboard/Chart'));
const CheckoutForm = lazy(() => import('checkout/CheckoutForm'));

function App() {
  return (
    <div className="app">
      <nav>
        <a href="/dashboard">仪表盘</a>
        <a href="/checkout">结账</a>
      </nav>

      <main>
        <Suspense fallback={<div>加载中...</div>}>
          <Route path="/dashboard">
            <div>
              <DashboardWidget title="用户统计" />
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

## 共享依赖详解

Shared 配置控制依赖如何在 Host 和 Remote 之间共享：

```js
shared: {
  react: {
    // singleton: true 确保只加载一个 React 实例
    // 如果 Host 和 Remote 的 React 版本不兼容，会加载两个实例（non-singleton）
    singleton: true,

    // 版本要求，语义化版本范围
    requiredVersion: '^16.8.0',

    // eager: true 将依赖打包到入口 chunk 而不是懒加载
    // 适用于需要在模块加载前就使用的场景（如 polyfills）
    eager: false,

    // strictVersion: true 版本不匹配时报错，false 则加载多个版本
    strictVersion: true,
  },
}
```

### 版本协商机制

当 Host 和 Remote 共享同一个依赖时，Webpack 会进行版本协商：

```
Host: react@16.12.0
Remote: react@16.10.0
requiredVersion: ^16.8.0

两个版本都满足 ^16.8.0，所以：
- 如果 singleton: true → 使用 Host 的 react@16.12.0
- 如果 singleton: false → 各自使用各自的版本
```

如果版本不兼容：

```
Host: react@16.12.0
Remote: react@17.0.0（假设）
requiredVersion: ^16.8.0

Remote 的 react@17.0.0 不满足 ^16.8.0：
- 如果 strictVersion: true → 报错
- 如果 strictVersion: false → Remote 使用自己的 react@17.0.0
```

## 动态加载 Remote

在某些场景下，Remote 地址是动态的（比如从配置中心获取）：

```js
// remote-loader.js
async function loadRemoteModule(url, scope, module) {
  // 步骤1: 加载远程容器脚本
  await new Promise((resolve, reject) => {
    const element = document.createElement('script');
    element.src = url;
    element.type = 'text/javascript';
    element.async = true;
    element.onload = resolve;
    element.onerror = reject;
    document.head.appendChild(element);
  });

  // 步骤2: 初始化共享作用域
  await __webpack_init_sharing__('default');

  // 步骤3: 获取并初始化远程容器
  const container = window[scope];
  await container.init(__webpack_share_scopes__.default);

  // 步骤4: 获取远程模块
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

## 实战：微前端应用架构

### 项目结构

```
micro-frontend/
├── shell/                  # 主应用（Host）
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Router.jsx
│   │   └── bootstrap.js
│   └── webpack.config.js
├── apps/
│   ├── products/          # 商品应用（Remote + Host）
│   │   ├── src/
│   │   └── webpack.config.js
│   ├── orders/            # 订单应用（Remote）
│   │   ├── src/
│   │   └── webpack.config.js
│   └── shared/            # 共享组件库（Remote）
│       ├── src/
│       └── webpack.config.js
└── package.json
```

### Shell 主应用

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

### Products 应用（既是 Remote 又是 Host）

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
          <a href="/orders">订单管理</a>
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

## 与其他微前端方案对比

| 特性 | Module Federation | qiankun | single-spa |
|
------|------------------|---------|------------|
| 隔离级别 | CSS 共享作用域 | JS/CSS 沙箱 | JS 沙箱 |
| 通信方式 | 直接 import | 全局状态 | 自定义 |
| 依赖共享 | 内置版本协商 | 需要配置 | 需要 import maps |
| 构建要求 | 必须 Webpack 5 | 无要求 | 无要求 |
| 子应用加载 | 模块级别 | 应用级别 | 应用级别 |

## 小结

- Module Federation 允许独立构建的应用在运行时共享模块
- Host 通过 `remotes` 配置消费远程模块，Remote 通过 `exposes` 暴露模块
- `remoteEntry.js` 是远程容器的入口文件
- `shared` 配置实现依赖共享，`singleton: true` 确保只加载一个实例
- 支持动态加载，适用于配置驱动的微前端架构
- 一个应用可以同时是 Host 和 Remote
- 与 qiankun 等方案相比，Module Federation 的优势在于模块级别的共享和内置的依赖协商
