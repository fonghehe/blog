---
title: "Webpack 5 Beta 新機能：Module Federationと永続キャッシュ"
date: 2020-01-20 16:34:10
tags:
  - Webpack
  - エンジニアリング
readingTime: 4
description: "Webpack 5 还在 Beta 阶段，但社区讨论已经很热了。花了一周时间试了两个最重要的新特性：Module Federation 和持久缓存。记录一下心得。"
wordCount: 596
---

Webpack 5 はまだ Beta 段階だが、コミュニティでの議論はすでに盛んだ。一週間かけてもっとも重要な2つの新機能——Module Federation と永続キャッシュ——を試したので、所見を記しておく。

## 永続キャッシュ

これが一番興奮した機能だ。今のプロジェクトでは Webpack のコールドスタートに 60 秒以上かかるが、永続キャッシュを使うと体感がまったく変わる。

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

**実測の効果：**

```
第一次构建（冷启动）:  58s   ← 和以前一样
第二次构建（热缓存）:   4s   ← 快了 10 倍以上
第三次构建（改了业务代码）: 6s   ← 只重编译改动的模块

对比：
  - Webpack 4 + hard-source-webpack-plugin：约 15s（还经常出 bug）
  - Webpack 5 filesystem cache：4s（原生支持，稳定）
```

**原理：**

```
Webpack 4 的问题：
  每次构建都要完整解析所有模块 → AST → 生成代码
  hard-source 插件是社区方案，不够稳定

Webpack 5 的做法：
  - 将模块的编译结果（包括 AST）缓存到文件系统
  - 下次构建时，如果模块文件和配置都没变，直接用缓存
  - 增量构建时，只重新编译变化的模块
```

**注意点：**

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

この機能は Zack Jackson が提案したもので、核心となる考え方は：**異なる Webpack のビルド成果物同士がモジュールを相互に参照できるようにする**ことだ。

噛み砕いて言えば：あるアプリが実行時に別のアプリのコードを、まるでローカルモジュールを読み込むように取得できる。

### 基本概念

```
传统微前端的问题：
  - iframe：隔离太重，通信麻烦
  - single-spa：需要统一框架版本，共享复杂

Module Federation 的做法：
  - 每个应用独立构建、独立部署
  - 运行时按需加载远程模块
  - 共享依赖（React/Vue 只加载一份）
```

### 設定例

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

### メインアプリでのリモートモジュールの利用

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

### 依存関係の共有戦略

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

## Asset Modules（file-loader/url-loader の代替）

Webpack 5 はリソース処理を組み込みで持ち、追加の loader をインストールする必要がなくなった。

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

## その他の注目すべき変更

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

## アップグレード計画

現時点での戦略は：**急いで上げない**ことだ。

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

## まとめ

- 永続キャッシュは Webpack 5 でもっとも実用的な特性で、2回目以降のビルド時間を一桁減らせる
- Module Federation はマイクロフロントエンドの新しい考え方で、実行時のモジュール共有は iframe や single-spa より洗練されている
- Asset Modules はリソース設定を簡略化し、file-loader / url-loader が不要になる
- Webpack 5 は現時点でもまだ Beta なので、本番プロジェクトは正式版を待ってからアップグレードすることを推奨する
- Vite などの新しいツールの登場とともに、2020 年はビルドツールの分野で大きな変化があるだろう
