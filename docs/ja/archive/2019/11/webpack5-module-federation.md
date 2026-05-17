---
title: "Webpack 5アップグレードガイド：Module Federation入門"
date: 2019-11-15 16:18:45
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "Webpack 5 Beta 版已经可以试用，最受关注的是 Module Federation（模块联邦）。这个特性可能会改变微前端的做法。"
---

Webpack 5 Beta 版已经可以试用，最受关注的是 Module Federation（模块联邦）。这个特性可能会改变微前端的做法。

## Webpack 5の主な変更点

### 持久化缓存（最重要）

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: "filesystem", // 缓存到硬盘（之前只有内存缓存）
    buildDependencies: {
      config: [__filename], // 配置文件变化时失效缓存
    },
  },
};
// 二次构建速度提升极其明显（我测试从 60s → 8s）
```

### 废弃 Node.js polyfill

```javascript
// Webpack 4：自动 polyfill Node.js 内置模块
// Webpack 5：不再自动 polyfill，需要手动配置
module.exports = {
  resolve: {
    fallback: {
      path: require.resolve("path-browserify"),
      crypto: require.resolve("crypto-browserify"),
      // 不需要的模块设为 false
      fs: false,
    },
  },
};
```

## Module Federation：マイクロフロントエンドの新しいアプローチ

```javascript
// host-app/webpack.config.js（消费方）
const { ModuleFederationPlugin } = require("webpack").container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "host",
      remotes: {
        // 声明远程应用
        checkout: "checkout@http://localhost:3001/remoteEntry.js",
        analytics: "analytics@http://localhost:3002/remoteEntry.js",
      },
      shared: {
        // 共享依赖（避免重复加载）
        react: { singleton: true, requiredVersion: "^16.8.0" },
        "react-dom": { singleton: true },
      },
    }),
  ],
};
```

```javascript
// checkout-app/webpack.config.js（提供方）
new ModuleFederationPlugin({
  name: "checkout",
  filename: "remoteEntry.js", // 入口文件
  exposes: {
    // 暴露给其他应用使用的模块
    "./CheckoutForm": "./src/components/CheckoutForm",
    "./CartSummary": "./src/components/CartSummary",
  },
  shared: {
    react: { singleton: true },
    "react-dom": { singleton: true },
  },
});
```

```javascript
// host-app：动态加载远程组件
import React, { lazy, Suspense } from "react";

// 像普通导入一样，但实际是从远程加载
const CheckoutForm = lazy(() => import("checkout/CheckoutForm"));
const CartSummary = lazy(() => import("checkout/CartSummary"));

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <CartSummary />
      <CheckoutForm />
    </Suspense>
  );
}
```

## Module Federation vs 従来のマイクロフロントエンド

|            | single-spa           | Module Federation   |
| ---------- | -------------------- | ------------------- |
| 粒度       | 应用级别             | 组件/模块级别       |
| 共享依赖   | 手动（systemjs map） | 自动（shared 配置） |
| 运行时     | 需要主应用调度       | 按需加载            |
| 独立部署   | ✅                   | ✅                  |
| 技术栈限制 | 无                   | 需要 Webpack 5      |

## 落とし穴

1. **版本不一致**：shared 的 `singleton: true` 确保只有一个实例
2. **本地开发**：需要同时启动多个开发服务器
3. **类型支持**：TypeScript 还需要手动声明远程模块的类型

## まとめ

- Webpack 5 持久化缓存是最实际的收益，二次构建极快
- Module Federation 是微前端的新思路：模块级共享，而不是应用级隔离
- Webpack 5 还在 Beta，等正式版（2020 年）再用于生产
