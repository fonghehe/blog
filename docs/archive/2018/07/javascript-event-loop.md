---
title: "JavaScript 事件循环深入理解"
date: 2018-07-07 10:43:20
tags:
  - JavaScript
readingTime: 2
description: "事件循环（Event Loop）是 JavaScript 并发模型的核心，也是面试高频题。"
wordCount: 287
---

事件循环（Event Loop）是 JavaScript 并发模型的核心，也是面试高频题。

## 单线程与非阻塞

JavaScript 是单线程的，同一时刻只能执行一段代码。但通过事件循环，可以处理异步操作而不阻塞主线程。

## 执行栈与任务队列

```
┌────────────────────────────────────┐
│            Call Stack              │  ← 执行同步代码
├────────────────────────────────────┤
│       Web APIs（浏览器提供）         │  ← setTimeout, fetch, DOM 事件
├────────────────────────────────────┤
│   Macrotask Queue（宏任务队列）      │  ← setTimeout, setInterval, I/O
├────────────────────────────────────┤
│   Microtask Queue（微任务队列）      │  ← Promise.then, MutationObserver
└────────────────────────────────────┘
```

## 执行顺序

1. 执行完当前调用栈中的所有同步代码
2. 清空微任务队列（全部执行完）
3. 执行一个宏任务
4. 回到步骤 2

```javascript
console.log("1"); // 同步

setTimeout(() => console.log("2"), 0); // 宏任务

Promise.resolve()
  .then(() => console.log("3")) // 微任务
  .then(() => console.log("4")); // 微任务

console.log("5"); // 同步

// 输出：1 5 3 4 2
```

分析：

1. 同步：打印 1、5
2. 微任务：打印 3（then 链第一个），再打印 4（then 链第二个）
3. 宏任务：打印 2

## async/await 的本质

```javascript
async function foo() {
  console.log("A");
  await bar();
  console.log("C"); // await 后面等价于 .then 回调（微任务）
}

function bar() {
  return Promise.resolve();
}

foo();
console.log("B");

// 输出：A B C
```

`await` 暂停函数执行，把后续代码放入微任务队列。

## 经典题目

```javascript
async function async1() {
  console.log("async1 start");
  await async2();
  console.log("async1 end"); // 微任务
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

// 输出：
// start
// async1 start
// async2
// promise executor
// end
// async1 end    ← 微任务
// promise then  ← 微任务
// timeout       ← 宏任务
```

## Node.js 的差异

Node.js 有额外的宏任务类型：`setImmediate`（在 I/O 回调后执行）和 `process.nextTick`（比 Promise 微任务优先级更高）。

```javascript
// Node.js 中
process.nextTick(() => console.log("nextTick")); // 最先
Promise.resolve().then(() => console.log("promise")); // 其次
setImmediate(() => console.log("setImmediate")); // 最后

// nextTick → promise → setImmediate
```

## 小结

- JS 单线程，事件循环处理异步
- 微任务（Promise.then）优先于宏任务（setTimeout）
- 每个宏任务执行后，会清空所有微任务
- `async/await` 是 Promise 的语法糖，await 后是微任务
