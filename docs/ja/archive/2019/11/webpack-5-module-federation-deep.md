---
title: "Webpack 5 Module Federation 深掘り：微前端的下一个答案"
date: 2019-11-06 11:20:08
tags:
  - Webpack
  - エンジニアリング
readingTime: 6
description: "在上一篇文章中我们预览了 Webpack 5 的新特性，其中 Module Federation 是最具革命性的功能。本文将深入探讨 Module Federation 的架构设计、配置细节和在微前端场景中的实战应用。"
wordCount: 1149
---

前回の記事では Webpack 5 の新機能を紹介しましたが、その中でも Module Federation は最も革新的な機能です。本記事では Module Federation のアーキテクチャ設計、設定の詳細、そしてマイクロフロントエンドの実践的な活用について深く掘り下げます。

## Module Federationのコアアイデア

Module Federation を使うと、ある JavaScript アプリケーションが、ビルド時に依存関係を決めておかずに、実行時に別のアプリケーションが公開したモジュールを動的に読み込めるようになります。つまり：

1. 各アプリケーションは独立してビルド・デプロイされる
2. 共有コードを npm パッケージとして公開する必要がない
3. 依存関係をアプリケーション間で共有でき、重複した読み込みを避けられる

## コアコンセプトの詳解

### Host と Remote

```
┌──────────────────┐         ┌──────────────────┐
│   Host (消费者)    │ ──────> │   Remote (提供者)  │
│                  │  运行时   │                  │
│  import('remote/ │  加载     │  exposes: {      │
│    Component')   │         │    './Component'  │
│                  │         │  }               │
└──────────────────┘         └──────────────────┘
```

- **Host**：リモートモジュールを消費するアプリケーションで、`remotes` 設定でリモートモジュールの取得元を指定します
- **Remote**：他のアプリケーションが使うモジュールを公開し、`exposes` 設定でどのモジュールを公開するかを指定します
- 1 つのアプリケーションが同時に Host にも Remote にもなれます

### コンテナ（Container）とエントリ（Entry）

ModuleFederationPlugin を設定した各アプリケーションをビルドすると `remoteEntry.js` というファイルが生成され、それがリモートコンテナのエントリーになります：

```
dashboard/
├── dist/
│   ├── remoteEntry.js       ← 容器入口
│   ├── main.js
│   └── vendors.js
```

Host アプリケーションはこの `remoteEntry.js` を読み込むことで、リモートコンテナを初期化します。

## 詳細設定

### Remote 側の設定

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

### Host 側の設定

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

### Host で Remote モジュールを使う

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

## 共有依存関係の詳解

`shared` の設定は、依存関係を Host と Remote の間でどう共有するかを制御します：

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

Host と Remote が同じ依存関係を共有する場合、Webpack はバージョンの調整（ネゴシエーション）を行います：

```
Host: react@16.12.0
Remote: react@16.10.0
requiredVersion: ^16.8.0

两个版本都满足 ^16.8.0，所以：
- 如果 singleton: true → 使用 Host 的 react@16.12.0
- 如果 singleton: false → 各自使用各自的版本
```

バージョンに互換性がない場合：

```
Host: react@16.12.0
Remote: react@17.0.0（假设）
requiredVersion: ^16.8.0

Remote 的 react@17.0.0 不满足 ^16.8.0：
- 如果 strictVersion: true → 报错
- 如果 strictVersion: false → Remote 使用自己的 react@17.0.0
```

## Remoteの動的読み込み

一部のケースでは、Remote のアドレスが動的です（たとえば設定センターから取得する場合など）：

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

## 実践：マイクロフロントエンドアーキテクチャ

### プロジェクト構造

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

### Shell（メインアプリケーション）

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

### Products アプリ（Remote かつ Host）

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

### ルーティングの統合

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

## 他のマイクロフロントエンドソリューションとの比較

| 特性 | Module Federation | qiankun | single-spa |
|------|------------------|---------|------------|
| 隔離レベル | CSS 共有スコープ | JS/CSS サンドボックス | JS サンドボックス |
| 通信方式 | 直接 import | グローバル状態 | カスタム |
| 依存共有 | 組み込みのバージョン調整 | 設定が必要 | import maps が必要 |
| ビルド要件 | Webpack 5 が必須 | 要件なし | 要件なし |
| 子アプリの読み込み | モジュール単位 | アプリ単位 | アプリ単位 |

## まとめ

- Module Federation は、独立してビルドされたアプリケーション同士が実行時にモジュールを共有できるようにします
- Host は `remotes` 設定でリモートモジュールを消費し、Remote は `exposes` でモジュールを公開します
- `remoteEntry.js` はリモートコンテナのエントリーファイルです
- `shared` 設定で依存関係の共有を実現し、`singleton: true` によって 1 つのインスタンスのみが読み込まれることを保証します
- 動的な読み込みに対応しており、設定駆動のマイクロフロントエンドアーキテクチャに適しています
- 1 つのアプリケーションが同時に Host にも Remote にもなれます
- qiankun などの手法と比べ、Module Federation の強みはモジュール単位の共有と組み込みの依存関係調整にあります
