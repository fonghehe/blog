---
title: "Webpack HMR 熱更新原理"
date: 2018-08-25 09:35:16
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "開發時修改代碼，頁面自動更新，這是 HMR（Hot Module Replacement）。平時用得理所當然，今天研究了一下原理。"
---

開發時修改代碼，頁面自動更新，這是 HMR（Hot Module Replacement）。平時用得理所當然，今天研究了一下原理。

## HMR 的整體流程

```
1. Webpack 監聽文件變化（watch 模式）
2. 文件變化 → 重新編譯變化的模塊
3. 編譯完成 → 通過 WebSocket 通知瀏覽器（發送 hash）
4. 瀏覽器收到通知 → 向 dev server 請求更新的模塊（manifest + chunk）
5. 瀏覽器接收新模塊 → HMR Runtime 替換舊模塊
6. 如果替換成功 → 局部更新，頁面不刷新
7. 如果替換失敗 → 強制刷新整個頁面（fallback）
```

## webpack-dev-server 的角色

```javascript
// webpack-dev-server 做了兩件事：
// 1. 啓動 HTTP 服務（伺服靜態資源）
// 2. 啓動 WebSocket 服務（推送更新通知）

// 瀏覽器端注入的 HMR 客户端代碼（bundle 裏包含了這段）
// 建立 WebSocket 連接，監聽 webpack 的編譯事件
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

## 模塊替換的實現

```javascript
// webpack 編譯後的模塊都註冊在 __webpack_modules__ 對象中
// HMR Runtime 替換就是替換這個對象中的對應函數

// 假設 foo.js 修改了：
__webpack_modules__["./src/foo.js"] = function (module, exports) {
  // 這裏是新的 foo.js 代碼
};

// 然後通知依賴 foo.js 的模塊重新執行
// 如果有模塊處理了 hot.accept，局部更新
// 否則向上冒泡，直到有模塊處理或觸發整頁刷新
```

## module.hot.accept：局部熱替換

```javascript
// 在模塊裏聲明接受自身的熱更新
if (module.hot) {
  module.hot.accept("./utils", () => {
    // utils.js 更新後，這裏的回調被調用
    const newUtils = require("./utils");
    updateUI(newUtils);
  });
}
```

Vue 和 React 的 HMR 之所以"自動"，是因為 vue-loader 和 react-refresh 自動幫你注入了 `module.hot.accept` 邏輯。

## vue-loader 怎麼處理 HMR

```javascript
// vue-loader 編譯後，大致注入了這樣的代碼：
if (module.hot) {
  module.hot.accept(); // 接受自身更新

  if (!isFirstRender) {
    // 用新的組件選項替換舊的
    const newOptions = require("./MyComponent.vue");
    component.options = newOptions;

    // 強制重新渲染
    component.__vue_hot__ = Date.now();
  }
}
```

## 保留狀態的 HMR

Vue 的 HMR 會保留組件狀態（data），只更新模板和方法。

```javascript
// 修改 MyComponent.vue 的 template
// HMR 後：data 裏的值不變，只有視圖更新

// ❌ 但這種情況會重置狀態（不得不如此）：
// - 修改了 data 的初始值
// - 修改了 created/mounted 鈎子
```

## CSS 的 HMR

CSS 更簡單，style-loader 會直接替換 `<style>` 標籤：

```javascript
// style-loader 注入的 HMR 代碼
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    // 移除舊的 style 標籤
    styleElement.remove();
  });
  // 添加新的 style 標籤
}
```

## 小結

- HMR 通過 WebSocket 推送更新通知，再 HTTP 拉取新模塊
- 模塊替換是更新 `__webpack_modules__` 中對應的函數
- `module.hot.accept` 聲明接受熱更新，vue-loader/react-refresh 自動注入
- CSS 熱更新直接替換 style 標籤，無狀態問題
- 替換失敗時 fallback 為整頁刷新
