---
title: "Webpack 5 正式版完全ガイド"
date: 2020-11-03 14:36:42
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "Webpack 5 正式版发布了。之前在 Beta 阶段预览过新特性，现在正式版出来后，做一次完整的升级实战。"
wordCount: 189
---

Webpack 5 正式版发布了。之前在 Beta 阶段预览过新特性，现在正式版出来后，做一次完整的升级实战。

## 主要な新機能の概要

```markdown
1. Module Federation：微前端模块共享
2. 持久化缓存：大幅提升二次构建速度
3. Asset Modules：内置资源处理，替代 file/url-loader
4. 增强 Tree Shaking：支持嵌套和 CommonJS
5. 更好的代码分割
6. 移除 Node.js polyfill
```

## 永続キャッシュの設定

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
    // 缓存版本，配置变更时递增
    version: '1.0',
  },
};

// 效果
// 首次构建：45 秒
// 二次构建：8 秒（利用缓存）
// 配置变更：重新构建，但其他未变模块仍走缓存
```

## Asset Modules

```javascript
module.exports = {
  module: {
    rules: [
      // 小于 8KB 的图片内联为 base64
      {
        test: /\.(png|jpg|gif|webp)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
        generator: {
          filename: 'images/[name].[contenthash:8][ext]',
        },
      },
      // SVG 作为独立文件
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: 'icons/[name].[contenthash:8][ext]',
        },
      },
      // 文本内容内联
      {
        test: /\.txt$/,
        type: 'asset/source',
      },
      // 字体文件
      {
        test: /\.(woff2?|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[contenthash:8][ext]',
        },
      },
    ],
  },
};
```

## Module Federation 実践

```javascript
// 基座应用 webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        // 引入微应用
        userModule: 'userModule@http://localhost:3001/remoteEntry.js',
        orderModule: 'orderModule@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
        'vue-router': { singleton: true },
      },
    }),
  ],
};

// 微应用 webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'userModule',
      filename: 'remoteEntry.js',
      exposes: {
        './UserList': './src/components/UserList.vue',
        './UserForm': './src/components/UserForm.vue',
      },
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
      },
    }),
  ],
};

// 基座应用中加载微应用组件
const UserList = () => import('userModule/UserList');
const UserForm = () => import('userModule/UserForm');
```

## 強化されたTree Shaking

```javascript
// package.json
{
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfills.js"
  ]
}

// webpack.config.js
module.exports = {
  optimization: {
    usedExports: true,
    innerGraph: true,  // Webpack 5 新增
    minimize: true,
  },
};
```

```javascript
// 更智能的 Tree Shaking
// utils.js
export function used() { return 'used'; }
export function unused() { return 'unused'; }
export function inner() { return 'inner'; }

// app.js
import { used } from './utils';
// unused() 和 inner() 会被 tree shake 掉

// Webpack 5 的 innerGraph 还能分析：
// 如果 inner() 只在 unused() 内部被调用
// 那 unused() 被移除后，inner() 也会一起被移除
```

## 移行実践

```bash
# アップグレード手順
npm install webpack@5 webpack-cli@4 -D
npm install webpack-dev-server@latest -D
npm install html-webpack-plugin@5 -D

# 移除已内置的 loader
npm uninstall file-loader url-loader raw-loader

# 可能需要更新的 loader
npm install css-loader@latest style-loader@latest -D
npm install mini-css-extract-plugin@latest -D
```

```javascript
// 常见报错和解决方案

// 1. Buffer is not defined
resolve: {
  fallback: {
    buffer: require.resolve('buffer/'),
  },
}
// 并安装 npm install buffer

// 2. process is not defined
resolve: {
  fallback: {
    process: require.resolve('process/browser'),
  },
}
// 并安装 npm install process

// 3. 自定义 Node.js polyfill 方案
const webpack = require('webpack');
plugins: [
  new webpack.ProvidePlugin({
    process: 'process/browser',
    Buffer: ['buffer', 'Buffer'],
  }),
]
```

## パフォーマンス比較

```markdown
| 项目规模 | Webpack 4 | Webpack 5 | 提升 |
|---------|-----------|-----------|------|
| 小项目首次构建 | 15s | 12s | 20% |
| 小项目二次构建 | 12s | 3s | 75% |
| 大项目首次构建 | 90s | 65s | 28% |
| 大项目二次构建 | 75s | 12s | 84% |
| 产物体积 | 1.2MB | 1.0MB | 17% |
```

## まとめ

- 持久化缓存是升级的最大动力，二次构建速度提升显著
- Asset Modules 简化了资源处理配置，可以移除 file/url-loader
- Module Federation 是微前端的官方方案，值得深入研究
- 移除了自动 polyfill，需要手动配置，增加了心智负担
- 建议在新项目中使用，老项目评估迁移成本后再决定
