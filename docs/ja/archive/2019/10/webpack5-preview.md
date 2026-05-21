---
title: "Webpack 5プレビュー：Module Federation"
date: 2019-10-14 16:20:40
tags:
  - Webpack
  - エンジニアリング
readingTime: 4
description: "Webpack 5 目前仍处于 Beta 阶段，但它带来了许多令人兴奋的改进。其中最值得关注的是 Module Federation——它彻底改变了前端微服务的实现方式。本文将介绍 Webpack 5 的核心新特性，并重点探讨 Module Federation 的工作原理。"
wordCount: 745
---

Webpack 5 目前仍处于 Beta 阶段，但它带来了许多令人兴奋的改进。其中最值得关注的是 Module Federation——它彻底改变了前端微服务的实现方式。本文将介绍 Webpack 5 的核心新特性，并重点探讨 Module Federation 的工作原理。

## Webpack 5 全体的な改善の概要

Webpack 5 的改进主要集中在以下几个方面：

### 长期缓存优化

Webpack 5 改进了模块 ID 和 chunk ID 的确定性算法：

```js
// webpack.config.js
module.exports = {
  // 使用确定性的模块 ID，避免模块 ID 变化导致缓存失效
  optimization: {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
  },
};
```

新增 `chunkIds` 和 `moduleIds` 选项：

- `'natural'`：按使用顺序的数字 ID
- `'named'`：可读的模块名称（开发用）
- `'deterministic'`：短数字 ID，构建间稳定（生产用）

### 持久化缓存

Webpack 5 内置了文件系统缓存，替代了 `hard-source-webpack-plugin`：

```js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],  // 配置文件变化时缓存失效
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
};
```

实测效果：

```
# 首次构建
webpack 5.0.0-beta.16 compiled successfully in 8342ms

# 二次构建（缓存命中）
webpack 5.0.0-beta.16 compiled successfully in 1203ms
```

### 更好的 Tree Shaking

Webpack 5 引入了嵌套 Tree Shaking 和内部模块 Tree Shaking：

```js
// package.json
{
  "sideEffects": false  // 标记整个包无副作用
}

// 或者指定有副作用的文件
{
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

Webpack 5 还支持 CommonJS 的 Tree Shaking：

```js
// 这种写法在 Webpack 5 中也能被 Tree Shaking
const { get } = require('lodash');
// 只会打包 lodash.get，而不是整个 lodash
```

### 模块联邦（Module Federation）

这是 Webpack 5 最具革命性的特性，允许在运行时动态加载其他独立构建的模块。

## Module Federationの深掘り

### コアコンセプト

Module Federation 的核心思想是：每个构建产物（bundle）既可以消费远程模块，也可以暴露自己的模块供其他构建产物使用。

关键术语：

- **Host**：消费远程模块的构建
- **Remote**：暴露模块供其他构建使用的构建
- **Shared**：多个构建之间共享的依赖

### 基础配置

假设有两个独立的前端应用：`app-shell`（主应用）和 `dashboard`（仪表盘应用）。

**dashboard 应用（Remote）暴露模块：**

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
        // 暴露模块路径：模块名
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

**app-shell 应用（Host）消费模块：**

```js
// app-shell/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index.js',
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_shell',
      remotes: {
        // 远程模块名: 远程容器变量名@入口地址
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

### 在代码中使用远程模块

```jsx
// app-shell/src/App.jsx
import React, { Suspense, lazy } from 'react';

// 动态导入远程模块
const Widget = lazy(() => import('dashboard/Widget'));
const Chart = lazy(() => import('dashboard/Chart'));

function App() {
  return (
    <div>
      <h1>应用外壳</h1>
      <Suspense fallback={<div>加载仪表盘组件...</div>}>
        <Widget title="用户统计" />
        <Chart type="line" data={chartData} />
      </Suspense>
    </div>
  );
}

export default App;
```

### 共享依赖的配置

Shared 配置控制多个构建之间的依赖共享方式：

```js
new ModuleFederationPlugin({
  shared: {
    react: {
      singleton: true,       // 只加载一个实例
      requiredVersion: '^16.8.0',
      eager: false,          // 懒加载（默认），不打包到入口 chunk
    },
    'react-dom': {
      singleton: true,
      requiredVersion: '^16.8.0',
    },
    // 可以使用通配符
    lodash: {
      singleton: false,      // 允许多个版本共存
    },
  },
});
```

配置选项说明：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `singleton` | 只加载一个实例 | false |
| `requiredVersion` | 版本要求 | package.json 中的版本 |
| `eager` | 是否打包到入口 chunk | false |
| `strictVersion` | 版本不匹配时是否报错 | true |

### 多 Remote 配置

一个应用可以同时消费多个 Remote：

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

### Remoteの動的読み込み

如果 Remote 地址是动态的，可以这样配置：

```js
// 在运行时动态加载远程模块
async function loadRemoteModule(url, scope, module) {
  // 加载远程入口脚本
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  // 初始化共享作用域
  await __webpack_init_sharing__('default');

  // 获取远程容器
  const container = window[scope];
  await container.init(__webpack_share_scopes__.default);

  // 获取远程模块
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

## 実際のアーキテクチャ方法

### 微前端架构

Module Federation 非常适合构建微前端架构：

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

每个团队可以独立开发、独立部署自己的 Remote 模块，App Shell 负责组装。

### 组件库共享

多个项目可以共享组件库而不需要发布 npm 包：

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

## まとめ

- Webpack 5 的核心改进：持久化缓存、确定性模块 ID、更好的 Tree Shaking
- Module Federation 允许独立构建的应用在运行时共享模块
- Host 消费远程模块，Remote 暴露模块，Shared 控制依赖共享
- `singleton: true` 确保共享依赖只加载一个实例
- 非常适合微前端架构和跨项目组件共享
- 支持动态加载和多 Remote 配置
- 预计 Webpack 5 正式版将在近期发布
