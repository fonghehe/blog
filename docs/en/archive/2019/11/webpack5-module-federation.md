---
title: "Webpack 5 Upgrade Guide: Introduction to Module Federation"
date: 2019-11-15 16:18:45
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "The Webpack 5 beta is already usable, and the most talked-about feature is Module Federation. This capability may well change how we do micro-frontends."
wordCount: 160
---

The Webpack 5 beta is already usable, and the most talked-about feature is Module Federation. This capability may well change how we do micro-frontends.

## Webpack 5 Major Changes

### Persistent Cache (Most Important)

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

### Dropping Node.js Polyfills

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

## Module Federation: New Micro-Frontend Approach

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

## Module Federation vs Traditional Micro-Frontends

|            | single-spa           | Module Federation   |
| ---------- | -------------------- | ------------------- |
| Granularity | App level          | Component/module level |
| Shared deps | Manual (systemjs map) | Automatic (`shared` config) |
| Runtime | Requires host app orchestration | Loaded on demand |
| Independent deploy | Yes | Yes |
| Tech stack constraint | None | Requires Webpack 5 |

## Pitfalls

1. **Version mismatch**: `shared` with `singleton: true` ensures only one instance
2. **Local development**: you need to run multiple dev servers at once
3. **Type support**: TypeScript still needs remote module types declared manually

## Summary

- Webpack 5's persistent cache is the most practical win; rebuilds are dramatically faster
- Module Federation is a new take on micro-frontends: module-level sharing instead of app-level isolation
- Webpack 5 is still in beta; wait for the stable release (2020) before using it in production
