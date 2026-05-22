---
title: "Vite：下一代前端構建工具體驗"
date: 2020-05-20 17:39:20
tags:
  - 工程化
readingTime: 1
description: "尤雨溪在直播中介紹了 Vite（法語\"快\"的意思），我立刻拿來試了試。感覺顛覆了我對開發工具的認知。"
wordCount: 308
---

尤雨溪在直播中介紹了 Vite（法語"快"的意思），我立刻拿來試了試。感覺顛覆了我對開發工具的認知。

## 核心思路：利用瀏覽器原生 ES Modules

傳統開發伺服器（Webpack dev server）：

- 啟動時打包所有模組
- 專案大 → 啟動時間長（我們專案現在要 60s）
- 熱更新也要重新打包相關模組

Vite 的做法：

- 啟動時**不打包**，直接利用瀏覽器原生 ESM
- 瀏覽器請求哪個模組，才處理哪個模組
- 啟動時間基本恆定（不管專案多大）

```
瀏覽器請求 /src/main.ts
 → Vite 攔截，即時編譯 TypeScript
 → 返回 ES Module
 → 瀏覽器解析 import，發出新請求
 → Vite 處理新請求...
```

## 實際體驗

```bash
npm init vite-app my-app
cd my-app
npm install
npm run dev  # 500ms 啟動！（Webpack 要 60s）
```

```javascript
// vite.config.js
module.exports = {
  // 配置極簡
  alias: {
    "@": "/src",
  },
  optimizeDeps: {
    // 預最佳化：把 CommonJS 依賴轉為 ESM（隻做一次）
    include: ["lodash-es", "axios"],
  },
};
```

## 和 Webpack 的區別

```javascript
// Webpack：需要大量設定才能支援 TypeScript
module.exports = {
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader" },
      { test: /\.vue$/, use: "vue-loader" },
      { test: /\.scss$/, use: ["style-loader", "css-loader", "sass-loader"] },
    ],
  },
  plugins: [...很多外掛],
};

// Vite：內建支援，零設定
// TypeScript、Vue、React、CSS、SCSS... 都開箱即用
```

## HMR 熱更新

```
Webpack HMR：
  檔案變化 → 重新編譯相關模組鏈 → 替換

Vite HMR：
  檔案變化 → 直接發 invalidation 訊號 → 瀏覽器重新請求該模組

  速度快很多，而且和專案大小無關
```

## 生產構建：基於 Rollup

```javascript
// 生產環境用 Rollup 打包（ESM + Tree Shaking）
// 不是直接服務 ESM（瀏覽器大量 HTTP 請求不適合生產）

// vite.config.js
module.exports = {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "vuex"],
        },
      },
    },
  },
};
```

## 2020 年 5 月的現狀

- 隻支援 Vue 3（當時）
- API 還不穩定（Vite 1.0 要年底）
- 部分邊緣情況處理不好
- SSR 支援還不完善

但這個方向是對的，我很確定。等 1.0 穩定後會在專案中使用。

## 小結

- Vite 利用原生 ESM，開發伺服器啟動幾乎瞬間
- 零設定支援 TS、Vue、React、CSS 前處理器
- 生產構建用 Rollup，輸出 ESM + 傳統格式
- 2020 年還不成熟，等 2021 年 Vite 2 再評估生產使用
