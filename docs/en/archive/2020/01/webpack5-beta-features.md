---
title: "Webpack 5 Beta New Features: Module Federation and Persistent Cache"
date: 2020-01-20 16:34:10
tags:
  - Webpack
  - Engineering
readingTime: 3
description: "Webpack 5 is still in beta, but community discussion is already heated. I spent a week trying its two most important new features—Module Federation and persistent cache—and here are my notes."
wordCount: 238
---

Webpack 5 is still in beta, but the community discussion is already heated. I spent a week trying its two most important new features—Module Federation and the persistent cache—and here are my notes.

## Persistent Cache

This is the feature I'm most excited about. Cold-starting Webpack in our project currently takes over 60 seconds, and the persistent cache makes the experience completely different.

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  cache: {
    type: 'filesystem',  // 关键：使用文件系统缓存

    // 缓存配置
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),

    // 构建依赖：这些文件变化时缓存失效
    buildDependencies: {
      config: [__filename],  // webpack 配置变化时清缓存
    },

    // 缓存名称（多配置时区分）
    name: `${process.env.NODE_ENV || 'development'}-cache`,

    // 版本号：手动控制缓存失效
    version: '1.0.0',
  },

  // 其他配置...
};
```

**Measured results:**

```
第一次构建（冷启动）:  58s   ← 和以前一样
第二次构建（热缓存）:   4s   ← 快了 10 倍以上
第三次构建（改了业务代码）: 6s   ← 只重编译改动的模块

对比：
  - Webpack 4 + hard-source-webpack-plugin：约 15s（还经常出 bug）
  - Webpack 5 filesystem cache：4s（原生支持，稳定）
```

**How it works:**

```
Webpack 4 的问题：
  每次构建都要完整解析所有模块 → AST → 生成代码
  hard-source 插件是社区方案，不够稳定

Webpack 5 的做法：
  - 将模块的编译结果（包括 AST）缓存到文件系统
  - 下次构建时，如果模块文件和配置都没变，直接用缓存
  - 增量构建时，只重新编译变化的模块
```

**Caveats:**

```javascript
// 1. loader 必须支持缓存
// 大多数主流 loader 已经支持了
// 如果自定义 loader，要实现 cacheable：
module.exports = function(source) {
  this.cacheable(true);  // 声明可缓存
  // ...
  return source;
};

// 2. 缓存目录要加入 .gitignore
// .gitignore
// .webpack_cache/

// 3. CI 环境可以持久化缓存目录
// .gitlab-ci.yml
// cache:
//   paths:
//     - .webpack_cache/
```

## Module Federation

This feature was proposed by Zack Jackson; the core idea is: **let different Webpack build artifacts reference each other's modules.**

Put simply: you can have one app load another app's code at runtime, just like loading a local module.

### Core Concepts

```
传统微前端的问题：
  - iframe：隔离太重，通信麻烦
  - single-spa：需要统一框架版本，共享复杂

Module Federation 的做法：
  - 每个应用独立构建、独立部署
  - 运行时按需加载远程模块
  - 共享依赖（React/Vue 只加载一份）
```

### Configuration Example

```javascript
// app-shell/webpack.config.js  （主应用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'appShell',
      filename: 'remoteEntry.js',

      // 消费远程模块
      remotes: {
        // 从 remoteApp 加载模块
        remoteApp: 'remoteApp@http://localhost:3001/remoteEntry.js',
        // 可以有多个远程源
        dashboard: 'dashboard@http://localhost:3002/remoteEntry.js',
      },

      // 共享依赖：避免重复加载
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
// remote-app/webpack.config.js  （远程应用）
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'remoteApp',
      filename: 'remoteEntry.js',

      // 暴露模块给其他应用使用
      exposes: {
        // 暴露整个组件
        './UserCard': './src/components/UserCard.vue',
        // 暴露工具函数
        './utils': './src/utils/index.ts',
        // 暴露路由配置
        './routes': './src/router/routes.ts',
      },

      // 同样声明共享依赖
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
        'vue-router': { singleton: true },
      },
    }),
  ],
};
```

### Using Remote Modules in the Host App

```vue
<!-- app-shell/src/views/Dashboard.vue -->
<template>
  <div>
    <h1>主应用 Dashboard</h1>
    <!-- 直接使用远程组件 -->
    <RemoteUserCard :user="currentUser" />
  </div>
</template>

<script>
import { defineAsyncComponent } from 'vue';

export default {
  components: {
    // 动态加载远程组件
    RemoteUserCard: defineAsyncComponent(() =>
      import('remoteApp/UserCard')
    ),
  },
};
</script>
```

```javascript
// 也可以在路由中使用远程模块
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

### Strategies for Shared Dependencies

```javascript
shared: {
  // 方式 1：简单共享
  vue: '^3.0.0',

  // 方式 2：详细配置
  vue: {
    singleton: true,          // 只加载一个版本
    requiredVersion: '^3.0.0', // 版本要求
    eager: false,              // false = 懒加载（推荐）
    // eager: true 会打包进 bundle，失去按需加载优势
  },

  // 方式 3：自动共享 package.json 的所有 dependencies
  ...require('./package.json').dependencies,
}
```

## Asset Modules (Replacing file-loader/url-loader)

Webpack 5 has built-in asset handling, so you no longer need to install extra loaders.

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      // 替代 file-loader
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset/resource',  // 输出单独文件
      },

      // 替代 url-loader（小于 8KB 转 base64）
      {
        test: /\.svg$/,
        type: 'asset',           // 自动选择
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,   // 8KB 阈值
          },
        },
      },

      // 替代 raw-loader
      {
        test: /\.txt$/,
        type: 'asset/source',    // 导出源码字符串
      },
    ],
  },

  // 资源输出配置
  output: {
    assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
  },
};
```

## Other Notable Changes

```javascript
// 1. 最低 Node.js 版本：10.13.0
// 2. 废弃了一些旧特性

// Top-level this 不再指向 module.exports
// 以前：
this.foo = 'bar';  // 在 Webpack 4 中等同于 module.exports.foo
// Webpack 5：this 指向 undefined（严格模式）

// 3. 内置的模块解析更智能
resolve: {
  // 支持 exports map（package.json 的 exports 字段）
  exportsFields: ['exports'],
  // 条件导出
  conditionNames: ['import', 'module', 'default'],
}
```

## Upgrade Plan

Our current strategy is: **don't rush the upgrade.**

```
原因：
  - Webpack 5 还是 Beta，API 可能变化
  - 部分 loader/plugin 还没适配（如 vue-loader 的某些版本）
  - 我们的项目已经很大，迁移成本高

计划：
  2020 Q1：在新项目中试用 Webpack 5
  2020 Q2：评估稳定性，准备主项目迁移方案
  2020 Q3-Q4：视 Webpack 5 正式版发布情况决定
```

## Summary

- The persistent cache is the most practical Webpack 5 feature—it cuts rebuild time by an order of magnitude.
- Module Federation is a new take on micro-frontends; runtime module sharing is more elegant than iframes and single-spa.
- Asset Modules simplify asset configuration and remove the need for file-loader / url-loader.
- Webpack 5 is still beta, so for production projects I'd wait for the stable release before upgrading.
- With new tools like Vite emerging, the build-tooling space will see big changes in 2020.
