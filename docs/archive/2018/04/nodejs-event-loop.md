---
title: "Node.js 事件循环深入理解"
date: 2018-04-09 11:02:57
tags:
  - JavaScript
---

Node.js 面试必问题目，但很多人只背了结论，没有理解背后的机制。这篇文章从实际代码的执行顺序出发，讲清楚事件循环。

## 为什么 Node.js 是单线程但不阻塞

Node.js 的主线程是单线程，但 I/O 操作（文件读写、网络请求）是交给操作系统异步处理的。

```
主线程  → 发起 I/O 请求  →  继续执行后续代码
           ↓（交给系统）
        系统完成 I/O  →  把回调放到事件队列
           ↓
主线程空闲时  →  从队列取出回调执行
```

这就是事件循环的基本思想。

## 事件循环的六个阶段

Node.js 的事件循环是 libuv 实现的，分为六个阶段：

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout / setInterval 的回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  上一轮循环延迟的 I/O 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  内部使用
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  获取新的 I/O 事件（主要阶段）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate 的回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  如 socket.on('close', ...)
   └───────────────────────────┘
```

## microtask 与 macrotask

这是最容易搞混的部分。

**macrotask（宏任务）：**

- `setTimeout`
- `setInterval`
- `setImmediate`
- I/O 回调

**microtask（微任务）：**

- `Promise.then/.catch/.finally`
- `process.nextTick`（优先级最高的微任务）
- `queueMicrotask`

**执行规则：每个宏任务执行完，立即清空所有微任务，然后再执行下一个宏任务。**

## 经典题目解析

```javascript
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve()
  .then(() => console.log("3"))
  .then(() => console.log("4"));

process.nextTick(() => console.log("5"));

console.log("6");
```

**执行顺序：1 6 5 3 4 2**

分析：

1. `1` - 同步代码
2. `setTimeout` 进宏任务队列
3. `Promise.then` 进微任务队列
4. `process.nextTick` 进 nextTick 队列（最高优先级微任务）
5. `6` - 同步代码
6. **清空微任务**：先 nextTick（`5`），再 Promise.then（`3`，`4`）
7. **下一个宏任务**：`setTimeout`（`2`）

## setImmediate vs setTimeout(fn, 0)

```javascript
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));
```

**结果不确定！** 在主模块执行时，顺序取决于系统定时器精度。

但在 I/O 回调内部，`setImmediate` **总是先于** `setTimeout`：

```javascript
const fs = require("fs");

fs.readFile("./file.txt", () => {
  setTimeout(() => console.log("setTimeout"), 0);
  setImmediate(() => console.log("setImmediate"));
});

// setImmediate 一定先输出
```

原因：I/O 回调在 poll 阶段执行，poll 结束后直接进入 check 阶段（setImmediate），然后才回到 timers 阶段（setTimeout）。

## process.nextTick 的陷阱

`process.nextTick` 的回调在每个阶段切换前执行，优先级最高。滥用可能饿死 I/O：

```javascript
// ❌ 递归 nextTick，I/O 永远不会执行
function loopNextTick() {
  process.nextTick(loopNextTick);
}
loopNextTick();
```

## 实际应用

```javascript
// 把同步代码变为异步（让调用者有机会设置事件监听）
class EventEmitter {
  emit(event, data) {
    process.nextTick(() => {
      this.listeners[event]?.forEach((fn) => fn(data));
    });
  }
}

// 确保异步 API 一致性
function readData(callback) {
  if (this.cache) {
    process.nextTick(() => callback(null, this.cache)); // 保持异步
    return;
  }
  fs.readFile("./data", callback);
}
```

## 小结

- 事件循环是 Node.js 处理并发的核心机制
- 微任务（Promise、nextTick）在每个宏任务结束后立即执行
- `process.nextTick` 优先级高于 Promise.then
- I/O 内部 `setImmediate` 先于 `setTimeout`
- 避免在 nextTick/Promise 里做无限递归，会阻塞 I/O
