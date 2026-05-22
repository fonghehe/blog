---
title: "JavaScript 事件迴圈深入理解"
date: 2018-07-07 10:43:20
tags:
  - JavaScript
readingTime: 2
description: "事件迴圈（Event Loop）是 JavaScript 併發模型的核心，也是面試高頻題。"
wordCount: 297
---

事件迴圈（Event Loop）是 JavaScript 併發模型的核心，也是面試高頻題。

## 單執行緒與非阻塞

JavaScript 是單執行緒的，同一時刻隻能執行一段程式碼。但通過事件迴圈，可以處理非同步操作而不阻塞主執行緒。

## 執行棧與任務佇列

```
┌────────────────────────────────────┐
│            Call Stack              │  ← 執行同步程式碼
├────────────────────────────────────┤
│       Web APIs（瀏覽器提供）         │  ← setTimeout, fetch, DOM 事件
├────────────────────────────────────┤
│   Macrotask Queue（宏任務佇列）      │  ← setTimeout, setInterval, I/O
├────────────────────────────────────┤
│   Microtask Queue（微任務佇列）      │  ← Promise.then, MutationObserver
└────────────────────────────────────┘
```

## 執行順序

1. 執行完當前呼叫棧中的所有同步程式碼
2. 清空微任務佇列（全部執行完）
3. 執行一個宏任務
4. 回到步驟 2

```javascript
console.log("1"); // 同步

setTimeout(() => console.log("2"), 0); // 宏任務

Promise.resolve()
  .then(() => console.log("3")) // 微任務
  .then(() => console.log("4")); // 微任務

console.log("5"); // 同步

// 輸出：1 5 3 4 2
```

分析：

1. 同步：列印 1、5
2. 微任務：列印 3（then 鏈第一個），再列印 4（then 鏈第二個）
3. 宏任務：列印 2

## async/await 的本質

```javascript
async function foo() {
  console.log("A");
  await bar();
  console.log("C"); // await 後面等價於 .then 回撥（微任務）
}

function bar() {
  return Promise.resolve();
}

foo();
console.log("B");

// 輸出：A B C
```

`await` 暫停函式執行，把後續程式碼放入微任務佇列。

## 經典題目

```javascript
async function async1() {
  console.log("async1 start");
  await async2();
  console.log("async1 end"); // 微任務
}

async function async2() {
  console.log("async2");
}

console.log("start");
setTimeout(() => console.log("timeout"), 0);
async1();
new Promise((resolve) => {
  console.log("promise executor");
  resolve();
}).then(() => console.log("promise then"));

console.log("end");

// 輸出：
// start
// async1 start
// async2
// promise executor
// end
// async1 end    ← 微任務
// promise then  ← 微任務
// timeout       ← 宏任務
```

## Node.js 的差異

Node.js 有額外的宏任務型別：`setImmediate`（在 I/O 回撥後執行）和 `process.nextTick`（比 Promise 微任務優先順序更高）。

```javascript
// Node.js 中
process.nextTick(() => console.log("nextTick")); // 最先
Promise.resolve().then(() => console.log("promise")); // 其次
setImmediate(() => console.log("setImmediate")); // 最後

// nextTick → promise → setImmediate
```

## 小結

- JS 單執行緒，事件迴圈處理非同步
- 微任務（Promise.then）優先於宏任務（setTimeout）
- 每個宏任務執行後，會清空所有微任務
- `async/await` 是 Promise 的語法糖，await 後是微任務
