---
title: "Webpack 5 Module Federation Deep Dive: The Next Answer for Micro Frontends"
date: 2019-11-06 11:20:08
tags:
  - Webpack
  - Engineering
readingTime: 4
description: "In a previous article we previewed the new features of Webpack 5, among which Module Federation is the most revolutionary. This article digs into its architecture, configuration details, and real-world use in micro-frontend scenarios."
wordCount: 389
---

In a previous article we previewed the new features of Webpack 5, among which Module Federation is the most revolutionary. This article digs into its architecture, configuration details, and real-world use in micro-frontend scenarios.

## Module Federation Core Idea

Module Federation lets one JavaScript application dynamically load modules exposed by another at runtime, without locking in the dependency at build time. That means:

1. Each app is built and deployed independently
2. Shared code doesn't need to be published as an npm package
3. Dependencies can be shared across apps, avoiding duplicate loading

## Core Concepts Explained

### Host and Remote

```
┌──────────────────┐         ┌──────────────────┐
│   Host (消费者)    │ ──────> │   Remote (提供者)  │
│                  │  运行时   │                  │
│  import('remote/ │  加载     │  exposes: {      │
│    Component')   │         │    './Component'  │
│                  │         │  }               │
└──────────────────┘         └──────────────────┘
```

- **Host**: the app that consumes remote modules, specifying their source via the `remotes` config
- **Remote**: the app that exposes modules for others to use, declaring them via the `exposes` config
- An app can be both a Host and a Remote at once

### Container and Entry

Every app configured with ModuleFederationPlugin produces a `remoteEntry.js` file on build—this is the entry point of the remote container:

```
dashboard/
├── dist/
│   ├── remoteEntry.js       ← 容器入口
│   ├── main.js
│   └── vendors.js
```

The Host app initializes the remote container by loading this `remoteEntry.js`.

## Detailed Configuration

### Remote-Side Configuration

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

### Host-Side Configuration

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

### Consuming Remote Modules in the Host

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

## Shared Dependencies In-Depth

The `shared` config controls how dependencies are shared between Host and Remote:

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

### Version Negotiation Mechanism

When both Host and Remote share a dependency, Webpack negotiates the version:

```
Host: react@16.12.0
Remote: react@16.10.0
requiredVersion: ^16.8.0

两个版本都满足 ^16.8.0，所以：
- 如果 singleton: true → 使用 Host 的 react@16.12.0
- 如果 singleton: false → 各自使用各自的版本
```

If the versions are incompatible:

```
Host: react@16.12.0
Remote: react@17.0.0（假设）
requiredVersion: ^16.8.0

Remote 的 react@17.0.0 不满足 ^16.8.0：
- 如果 strictVersion: true → 报错
- 如果 strictVersion: false → Remote 使用自己的 react@17.0.0
```

## Dynamic Remote Loading

In some scenarios the Remote address is dynamic—for example, fetched from a config center:

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

## In Practice: Micro-Frontend Architecture

### Project Structure

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

### The Shell App

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

### The Products App (Both Remote and Host)

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

### Route Integration

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

## Comparison with Other Micro-Frontend Solutions

| Feature | Module Federation | qiankun | single-spa |
|---------|-------------------|---------|------------|
| Isolation level | CSS shared scope | JS/CSS sandbox | JS sandbox |
| Communication | Direct import | Global state | Custom |
| Dependency sharing | Built-in version negotiation | Requires config | Requires import maps |
| Build requirement | Webpack 5 required | None | None |
| Child app loading | Module level | App level | App level |

## Summary

- Module Federation lets independently built apps share modules at runtime
- The Host consumes remote modules via `remotes`; the Remote exposes them via `exposes`
- `remoteEntry.js` is the entry file of the remote container
- The `shared` config enables dependency sharing; `singleton: true` ensures only one instance is loaded
- Dynamic loading is supported, which fits config-driven micro-frontend architectures
- An app can be both a Host and a Remote at once
- Compared with solutions like qiankun, Module Federation's edge is module-level sharing and built-in dependency negotiation
