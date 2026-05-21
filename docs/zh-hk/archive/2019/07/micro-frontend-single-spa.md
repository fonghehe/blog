---
title: "微前端落地實踐：基於 single-spa"
date: 2019-07-12 10:26:31
tags:
  - 微前端
  - 工程化
readingTime: 2
description: "公司的老後台系統是 2016 年的 jQuery 項目，新功能想用 Vue，但不能全量重寫。微前端解決了這個問題。"
wordCount: 421
---

公司的老後台系統是 2016 年的 jQuery 項目，新功能想用 Vue，但不能全量重寫。微前端解決了這個問題。

## 我們的場景

- 老系統：jQuery + Bootstrap，幾十個頁面
- 新需求：新模塊要用 Vue CLI 3 開發
- 目標：新老共存，逐步遷移，統一導航

## 為什麼選 single-spa

2019 年微前端框架不多：

- single-spa：最成熟，支持多框架
- qiankun（阿里）：基於 single-spa，API 更友好（我們調研時還沒到 1.0）

最終選了 single-spa。

## 架構設計

```
主應用（Shell）
├── 公共導航、權限管理、路由註冊
├── 子應用 A（Legacy jQuery）- /legacy/*
├── 子應用 B（Vue 2）- /orders/*
└── 子應用 C（Vue 2）- /analytics/*
```

## 主應用（Shell）

```javascript
// shell/src/index.js
import { registerApplication, start } from "single-spa";

// 註冊舊系統（jQuery）
registerApplication(
  "legacy",
  () => import("./apps/legacy-app"), // 加載函數
  (location) => location.pathname.startsWith("/legacy"), // 激活條件
);

// 註冊 Vue 子應用
registerApplication(
  "orders",
  () => System.import("http://localhost:8081/orders-app.js"),
  (location) => location.pathname.startsWith("/orders"),
);

registerApplication(
  "analytics",
  () => System.import("http://localhost:8082/analytics-app.js"),
  (location) => location.pathname.startsWith("/analytics"),
);

// 啓動
start();
```

## Vue 子應用適配

```javascript
// orders-app/src/main.js
import Vue from "vue";
import App from "./App.vue";
import router from "./router";

let vueInstance = null;

// single-spa 生命週期
export async function bootstrap() {
  console.log("orders app bootstrapped");
}

export async function mount(props) {
  // props 包含主應用傳遞的數據（用户信息、全局狀態等）
  const { container, userInfo } = props;

  vueInstance = new Vue({
    router,
    render: (h) => h(App, { props: { userInfo } }),
  }).$mount(container || "#orders-container");
}

export async function unmount() {
  vueInstance.$destroy();
  vueInstance.$el.innerHTML = "";
  vueInstance = null;
}
```

## 樣式隔離

```javascript
// 方案 1：CSS Modules（推薦）
// 構建時自動 hash 化類名，天然隔離

// 方案 2：BEM 命名約定
.orders-module__header { }
.orders-module__content { }

// 方案 3：Shadow DOM（侵入性最低，但 IE 不支持）
// qiankun 的 experimentalStyleIsolation 用的這個方案
```

## 子應用間通信

```javascript
// shell/src/eventBus.js（全局事件總線）
class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback); // 返回取消訂閲函數
  }

  emit(event, data) {
    this.events[event]?.forEach((cb) => cb(data));
  }

  off(event, callback) {
    this.events[event] = this.events[event]?.filter((cb) => cb !== callback);
  }
}

// 掛載到 window（子應用通過 window 訪問）
window.__MICRO_APP_BUS__ = new EventBus();

// 子應用中使用
window.__MICRO_APP_BUS__.emit("user:logout", {});
window.__MICRO_APP_BUS__.on("theme:change", (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
});
```

## 踩過的坑

1. **全局變量污染**：子應用卸載時要清理註冊的全局變量、事件監聽
2. **CSS 全局污染**：第三方 UI 庫（Element UI）的全局樣式會互相影響
3. **路由衝突**：子應用路由要用 `base` 配置，和主應用路由不衝突
4. **依賴重複**：每個子應用都打包 Vue，體積大。可以用 CDN 共享

## 我們的遷移路線

第一階段（3 個月）：新功能模塊用 Vue 開發，通過微前端掛載
第二階段（6 個月）：把高頻訪問的舊頁面逐步遷移到 Vue 子應用
第三階段（長期）：老系統功能全部遷完後，Legacy 子應用下線

## 小結

- 微前端適合"大型遺留系統漸進遷移"或"多團隊並行開發"
- single-spa 的核心是註冊子應用和生命週期（bootstrap/mount/unmount）
- 樣式隔離推薦 CSS Modules，子應用通信用全局事件總線
- 常見坑：全局變量污染、CSS 污染、路由衝突
