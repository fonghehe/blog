---
title: "前端工程化小結：2018年我學到了什麼"
date: 2018-11-29 15:54:00
tags:
  - 前端
readingTime: 2
description: "做前端整整兩年了，今年算是真正進入\"工程化\"的視野。借這篇文章梳理一下，也給自己一個年底回顧的錨點。"
wordCount: 503
---

做前端整整兩年了，今年算是真正進入"工程化"的視野。借這篇文章梳理一下，也給自己一個年底回顧的錨點。

## 從"能跑"到"工程化"的轉變

剛入行的時候，能讓頁面跑起來就行。今年開始意識到，做產品需要的不隻是能跑：

```
以前關心：這個功能能不能做
現在關心：這個功能好不好維護、好不好測試、好不好協作
```

具體體現在：

**程式碼組織**：從把所有邏輯堆在元件裡，到按關注點分離（API 層、狀態管理、工具函式）

**構建工具**：從"專案裡有 webpack 設定，但我看不懂"，到能根據需要設定 Tree Shaking、程式碼分割、環境變數

**程式碼質量**：引入了 ESLint + Prettier，現在程式碼風格統一了；開始寫單元測試，至少核心邏輯有測試覆蓋

## 今年收穫最大的幾個知識點

### 1. Vue 響應式原理

知道 `Object.defineProperty` 是怎麼工作的之後，很多"奇怪的現象"都有了解釋：

```javascript
// 為什麼這樣不響應？
this.obj.newKey = "value"; // ❌

// 為什麼這樣可以？
this.$set(this.obj, "newKey", "value"); // ✅
Vue.set(this.obj, "newKey", "value"); // ✅
```

### 2. 非同步 JavaScript

```javascript
// 回撥 → Promise → async/await 的演進
// 現在理解了為什麼 async/await 是生成器+Promise 的語法糖
// 也知道了 Promise.all/race/allSettled 的區別

// 這讓我在處理併發請求時有了更多工具
const [users, orders] = await Promise.all([api.getUsers(), api.getOrders()]);
```

### 3. 效能最佳化

```
Lighthouse 成了日常工具
學會看 Chrome DevTools 的 Performance 面板
理解了 CRP（關鍵渲染路徑）
用 transform/opacity 做動畫代替 left/top
```

### 4. TypeScript

```typescript
// 從"不知道有什麼用"到"真香"
// 最大的收穫不是型別安全本身，而是 IDE 的智慧提示
// 重構的時候，TS 的型別錯誤幫我找到了很多漏改的地方
```

## 還沒掌握好的

坦白說，有些東西還是處於"知道但不熟"的階段：

- **測試**：寫了一些單元測試，但整合測試、E2E 測試沒有實踐
- **CI/CD**：專案裡有 Jenkins，但我不太懂配置，出問題了還是找運維
- **效能監控**：理論上懂，但線上監控系統還沒搭起來
- **Nginx 配置**：能改，但不能從頭寫

## 2019 年想做的

React：現在團隊主要用 Vue，但 React 的生態很強，React Hooks 的提案很有趣

TypeScript 進階：現在隻會基礎用法，高階型別（條件型別、對映型別）想深入學

Node.js：寫一個完整的 BFF（Backend for Frontend）層，不隻是寫指令碼

## 小結

2018 年是從"熟練工"到"工程師"轉變的一年。技術不隻是會用，還要理解原理，還要懂得如何在團隊中協作。

希望 2019 年寫的程式碼質量更上一層樓。
