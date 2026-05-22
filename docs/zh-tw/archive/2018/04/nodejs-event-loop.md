---
title: "Node.js 事件迴圈深入理解"
date: 2018-04-09 11:02:57
tags:
  - JavaScript
readingTime: 2
description: "Node.js 面試必問題目，但很多人隻背了結論，沒有理解背後的機製。這篇文章從實際程式碼的執行順序出發，講清楚事件迴圈。"
wordCount: 474
---

Node.js 面試必問題目，但很多人隻背了結論，沒有理解背後的機製。這篇文章從實際程式碼的執行順序出發，講清楚事件迴圈。

## 為什麼 Node.js 是單執行緒但不阻塞

Node.js 的主執行緒是單執行緒，但 I/O 操作（檔案讀寫、網路請求）是交給作業系統非同步處理的。

```
主執行緒  → 發起 I/O 請求  →  繼續執行後續程式碼
           ↓（交給系統）
        系統完成 I/O  →  把回撥放到事件佇列
           ↓
主執行緒空閒時  →  從佇列取出回撥執行
```

這就是事件迴圈的基本思想。

## 事件迴圈的六個階段

Node.js 的事件迴圈是 libuv 實現的，分為六個階段：

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout / setInterval 的回撥
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  上一輪迴圈延遲的 I/O 回撥
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  內部使用
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  獲取新的 I/O 事件（主要階段）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate 的回撥
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  如 socket.on('close', ...)
   └───────────────────────────┘
```

## microtask 與 macrotask

這是最容易搞混的部分。

**macrotask（宏任務）：**

- `setTimeout`
- `setInterval`
- `setImmediate`
- I/O 回撥

**microtask（微任務）：**

- `Promise.then/.catch/.finally`
- `process.nextTick`（優先順序最高的微任務）
- `queueMicrotask`

**執行規則：每個宏任務執行完，立即清空所有微任務，然後再執行下一個宏任務。**

## 經典題目解析

```javascript
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve()
  .then(() => console.log("3"))
  .then(() => console.log("4"));

process.nextTick(() => console.log("5"));

console.log("6");
```

**執行順序：1 6 5 3 4 2**

分析：

1. `1` - 同步程式碼
2. `setTimeout` 進宏任務佇列
3. `Promise.then` 進微任務佇列
4. `process.nextTick` 進 nextTick 佇列（最高優先順序微任務）
5. `6` - 同步程式碼
6. **清空微任務**：先 nextTick（`5`），再 Promise.then（`3`，`4`）
7. **下一個宏任務**：`setTimeout`（`2`）

## setImmediate vs setTimeout(fn, 0)

```javascript
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));
```

**結果不確定！** 在主模組執行時，順序取決於系統定時器精度。

但在 I/O 回撥內部，`setImmediate` **總是先於** `setTimeout`：

```javascript
const fs = require("fs");

fs.readFile("./file.txt", () => {
  setTimeout(() => console.log("setTimeout"), 0);
  setImmediate(() => console.log("setImmediate"));
});

// setImmediate 一定先輸出
```

原因：I/O 回撥在 poll 階段執行，poll 結束後直接進入 check 階段（setImmediate），然後才回到 timers 階段（setTimeout）。

## process.nextTick 的陷阱

`process.nextTick` 的回撥在每個階段切換前執行，優先順序最高。濫用可能餓死 I/O：

```javascript
// ❌ 遞迴 nextTick，I/O 永遠不會執行
function loopNextTick() {
  process.nextTick(loopNextTick);
}
loopNextTick();
```

## 實際應用

```javascript
// 把同步程式碼變為非同步（讓呼叫者有機會設定事件監聽）
class EventEmitter {
  emit(event, data) {
    process.nextTick(() => {
      this.listeners[event]?.forEach((fn) => fn(data));
    });
  }
}

// 確保非同步 API 一致性
function readData(callback) {
  if (this.cache) {
    process.nextTick(() => callback(null, this.cache)); // 保持非同步
    return;
  }
  fs.readFile("./data", callback);
}
```

## 小結

- 事件迴圈是 Node.js 處理併發的核心機製
- 微任務（Promise、nextTick）在每個宏任務結束後立即執行
- `process.nextTick` 優先順序高於 Promise.then
- I/O 內部 `setImmediate` 先於 `setTimeout`
- 避免在 nextTick/Promise 裡做無限遞迴，會阻塞 I/O
