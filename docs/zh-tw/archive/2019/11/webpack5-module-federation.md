---
title: "Webpack 5 升級指南：Module Federation 初探"
date: 2019-11-15 16:18:45
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 5 Beta 版已經可以試用，最受關注的是 Module Federation（模組聯邦）。這個特性可能會改變微前端的做法。"
wordCount: 256
---

Webpack 5 Beta 版已經可以試用，最受關注的是 Module Federation（模組聯邦）。這個特性可能會改變微前端的做法。

## Webpack 5 主要變化

### 持久化快取（最重要）

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: "filesystem", // 快取到硬碟（之前只有記憶體快取）
    buildDependencies: {
      config: [__filename], // 配置檔案變化時失效快取
    },
  },
};
// 二次構建速度提升極其明顯（我測試從 60s → 8s）
```

### 廢棄 Node.js polyfill

```javascript
// Webpack 4：自動 polyfill Node.js 內建模組
// Webpack 5：不再自動 polyfill，需要手動配置
module.exports = {
  resolve: {
    fallback: {
      path: require.resolve("path-browserify"),
      crypto: require.resolve("crypto-browserify"),
      // 不需要的模組設為 false
      fs: false,
    },
  },
};
```

## Module Federation：微前端的新玩法

```javascript
// host-app/webpack.config.js（消費方）
const { ModuleFederationPlugin } = require("webpack").container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: "host",
      remotes: {
        // 宣告遠端應用
        checkout: "checkout@http://localhost:3001/remoteEntry.js",
        analytics: "analytics@http://localhost:3002/remoteEntry.js",
      },
      shared: {
        // 共享依賴（避免重複載入）
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
  filename: "remoteEntry.js", // 入口檔案
  exposes: {
    // 暴露給其他應用使用的模組
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
// host-app：動態載入遠端元件
import React, { lazy, Suspense } from "react";

// 像普通匯入一樣，但實際是從遠端載入
const CheckoutForm = lazy(() => import("checkout/CheckoutForm"));
const CartSummary = lazy(() => import("checkout/CartSummary"));

function App() {
  return (
    <Suspense fallback={<div>載入中...</div>}>
      <CartSummary />
      <CheckoutForm />
    </Suspense>
  );
}
```

## Module Federation vs 傳統微前端

|            | single-spa           | Module Federation   |
| 
---------- | -------------------- | ------------------- |
| 粒度       | 應用級別             | 元件/模組級別       |
| 共享依賴   | 手動（systemjs map） | 自動（shared 配置） |
| 執行時     | 需要主應用排程       | 按需載入            |
| 獨立部署   | ✅                   | ✅                  |
| 技術棧限制 | 無                   | 需要 Webpack 5      |

## 踩坑

1. **版本不一致**：shared 的 `singleton: true` 確保只有一個例項
2. **本地開發**：需要同時啟動多個開發伺服器
3. **型別支援**：TypeScript 還需要手動宣告遠端模組的型別

## 小結

- Webpack 5 持久化快取是最實際的收益，二次構建極快
- Module Federation 是微前端的新思路：模組級共享，而不是應用級隔離
- Webpack 5 還在 Beta，等正式版（2020 年）再用於生產
