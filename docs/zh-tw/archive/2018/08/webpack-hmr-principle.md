---
title: "Webpack HMR 熱更新原理"
date: 2018-08-25 09:35:16
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "開發時修改程式碼，頁面自動更新，這是 HMR（Hot Module Replacement）。平時用得理所當然，今天研究了一下原理。"
wordCount: 214
---

開發時修改程式碼，頁面自動更新，這是 HMR（Hot Module Replacement）。平時用得理所當然，今天研究了一下原理。

## HMR 的整體流程

```
1. Webpack 監聽檔案變化（watch 模式）
2. 檔案變化 → 重新編譯變化的模組
3. 編譯完成 → 通過 WebSocket 通知瀏覽器（傳送 hash）
4. 瀏覽器收到通知 → 向 dev server 請求更新的模組（manifest + chunk）
5. 瀏覽器接收新模組 → HMR Runtime 替換舊模組
6. 如果替換成功 → 區域性更新，頁面不重新整理
7. 如果替換失敗 → 強製重新整理整個頁面（fallback）
```

## webpack-dev-server 的角色

```javascript
// webpack-dev-server 做了兩件事：
// 1. 啟動 HTTP 服務（伺服靜態資源）
// 2. 啟動 WebSocket 服務（推送更新通知）

// 瀏覽器端注入的 HMR 客戶端程式碼（bundle 裡包含了這段）
// 建立 WebSocket 連線，監聽 webpack 的編譯事件
const socket = new WebSocket("ws://localhost:8080");
socket.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data);
  if (type === "hash") {
    currentHash = data; // 記錄最新 hash
  }
  if (type === "ok") {
    // 編譯完成，請求更新
    checkForUpdates();
  }
};
```

## 模組替換的實現

```javascript
// webpack 編譯後的模組都註冊在 __webpack_modules__ 物件中
// HMR Runtime 替換就是替換這個物件中的對應函式

// 假設 foo.js 修改了：
__webpack_modules__["./src/foo.js"] = function (module, exports) {
  // 這裡是新的 foo.js 程式碼
};

// 然後通知依賴 foo.js 的模組重新執行
// 如果有模組處理了 hot.accept，區域性更新
// 否則向上冒泡，直到有模組處理或觸發整頁重新整理
```

## module.hot.accept：區域性熱替換

```javascript
// 在模組裡宣告接受自身的熱更新
if (module.hot) {
  module.hot.accept("./utils", () => {
    // utils.js 更新後，這裡的回撥被呼叫
    const newUtils = require("./utils");
    updateUI(newUtils);
  });
}
```

Vue 和 React 的 HMR 之所以"自動"，是因為 vue-loader 和 react-refresh 自動幫你注入了 `module.hot.accept` 邏輯。

## vue-loader 怎麼處理 HMR

```javascript
// vue-loader 編譯後，大致注入了這樣的程式碼：
if (module.hot) {
  module.hot.accept(); // 接受自身更新

  if (!isFirstRender) {
    // 用新的元件選項替換舊的
    const newOptions = require("./MyComponent.vue");
    component.options = newOptions;

    // 強製重新渲染
    component.__vue_hot__ = Date.now();
  }
}
```

## 保留狀態的 HMR

Vue 的 HMR 會保留元件狀態（data），隻更新範本和方法。

```javascript
// 修改 MyComponent.vue 的 template
// HMR 後：data 裡的值不變，隻有檢視更新

// ❌ 但這種情況會重置狀態（不得不如此）：
// - 修改了 data 的初始值
// - 修改了 created/mounted 鉤子
```

## CSS 的 HMR

CSS 更簡單，style-loader 會直接替換 `<style>` 標籤：

```javascript
// style-loader 注入的 HMR 程式碼
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    // 移除舊的 style 標籤
    styleElement.remove();
  });
  // 新增新的 style 標籤
}
```

## 小結

- HMR 通過 WebSocket 推送更新通知，再 HTTP 拉取新模組
- 模組替換是更新 `__webpack_modules__` 中對應的函式
- `module.hot.accept` 宣告接受熱更新，vue-loader/react-refresh 自動注入
- CSS 熱更新直接替換 style 標籤，無狀態問題
- 替換失敗時 fallback 為整頁重新整理
