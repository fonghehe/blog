---
title: "Webpack 5 Preview: Module Federation"
date: 2019-10-14 16:20:40
tags:
  - Webpack
  - Engineering
readingTime: 4
description: "Webpack 5 is still in Beta, but it brings many exciting improvements. The most noteworthy is Module Federation—which fundamentally changes how frontend microservices are implemented. This article introduces Webpack 5's core new features, with a focus on how Module Federation works."
wordCount: 459
---

Webpack 5 is still in Beta, but it brings many exciting improvements. The most noteworthy is Module Federation—which fundamentally changes how frontend microservices are implemented. This article introduces Webpack 5's core new features, with a focus on how Module Federation works.

## Webpack 5 Overall Improvements Overview

Webpack 5's improvements focus on the following areas:

### Long-Term Caching Optimizations

Webpack 5 improved the deterministic algorithm for module IDs and chunk IDs:

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

Two new options were added, `chunkIds` and `moduleIds`:

- `'natural'`: numeric IDs in usage order
- `'named'`: human-readable module names (for development)
- `'deterministic'`: short numeric IDs that stay stable across builds (for production)

### Persistent Caching

Webpack 5 has built-in filesystem caching, replacing `hard-source-webpack-plugin`:

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

Measured results:

```
# 首次构建
webpack 5.0.0-beta.16 compiled successfully in 8342ms

# 二次构建（缓存命中）
webpack 5.0.0-beta.16 compiled successfully in 1203ms
```

### Better Tree Shaking

Webpack 5 introduced nested Tree Shaking and inner-module Tree Shaking:

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

Webpack 5 also supports Tree Shaking for CommonJS:

```js
// 这种写法在 Webpack 5 中也能被 Tree Shaking
const { get } = require('lodash');
// 只会打包 lodash.get，而不是整个 lodash
```

### Module Federation

This is the most revolutionary feature in Webpack 5—it lets you dynamically load modules from other independently built bundles at runtime.

## Module Federation In-Depth

### Core Concepts

The core idea of Module Federation is that every build artifact (bundle) can both consume remote modules and expose its own modules for other build artifacts to use.

Key terms:

- **Host**: a build that consumes remote modules
- **Remote**: a build that exposes modules for others to consume
- **Shared**: dependencies shared between multiple builds

### Basic Configuration

Suppose we have two independent frontend apps: `app-shell` (the host app) and `dashboard` (the dashboard app).

**The dashboard app (Remote) exposes these modules:**

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

**The app-shell app (Host) consumes these modules:**

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

### Using Remote Modules in Code

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

### Configuring Shared Dependencies

The `shared` config controls how dependencies are shared between builds:

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

Here's what the options mean:

| Option | Description | Default |
|--------|-------------|---------|
| `singleton` | Load only a single instance | false |
| `requiredVersion` | Required version | The version in package.json |
| `eager` | Whether to bundle into the entry chunk | false |
| `strictVersion` | Whether to error when versions mismatch | true |

### Multiple Remote Configuration

A single app can consume multiple Remotes at once:

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

### Dynamic Remote Loading

If the Remote address is dynamic, you can configure it like this:

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

## Real-World Architecture Patterns

### Micro-Frontend Architecture

Module Federation is a great fit for building a micro-frontend architecture:

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

Each team can develop and deploy its own Remote modules independently, while the App Shell is responsible for assembling them.

### Sharing a Component Library

Multiple projects can share a component library without having to publish an npm package:

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

## Summary

- Webpack 5's core improvements: persistent caching, deterministic module IDs, and better Tree Shaking
- Module Federation lets independently built apps share modules at runtime
- A Host consumes remote modules, a Remote exposes them, and Shared controls dependency sharing
- `singleton: true` ensures a shared dependency is loaded only once
- A great fit for micro-frontend architectures and cross-project component sharing
- Supports dynamic loading and multiple Remote configurations
- The official Webpack 5 release was expected to land soon
