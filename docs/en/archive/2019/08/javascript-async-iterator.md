---
title: "JavaScript Async Iterators and for-await-of"
date: 2019-08-21 17:03:21
tags:
  - JavaScript
readingTime: 4
description: "ES2018 引入了异步迭代器（Async Iterator）和 `for-await-of` 语法，让我们可以用同步的方式处理异步数据流。这个特性在处理分页 API、WebSocket 消息、文件流等场景下非常有用。本文将从迭代器协议讲起，深入理解异步迭代器的原理和实战应用。"
wordCount: 544
---

ES2018 引入了异步迭代器（Async Iterator）和 `for-await-of` 语法，让我们可以用同步的方式处理异步数据流。这个特性在处理分页 API、WebSocket 消息、文件流等场景下非常有用。本文将从迭代器协议讲起，深入理解异步迭代器的原理和实战应用。

## Review: Synchronous Iterators

在理解异步迭代器之前，先回顾同步迭代器。一个对象要可迭代（iterable），需要实现 `Symbol.iterator` 方法：

```js
// 自定义可迭代对象
const range = {
  from: 1,
  to: 5,

  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;

    return {
      next() {
        if (current <= last) {
          return { value: current++, done: false };
        }
        return { done: true };
      }
    };
  }
};

for (const num of range) {
  console.log(num); // 1, 2, 3, 4, 5
}
```

## Async Iterator Protocol

异步迭代器与同步迭代器的关键区别：

1. 方法名是 `Symbol.asyncIterator` 而非 `Symbol.iterator`
2. `next()` 返回的是 `Promise<{value, done}>` 而非 `{value, done}`
3. 使用 `for-await-of` 而非 `for-of` 进行迭代

```js
const asyncRange = {
  from: 1,
  to: 5,

  [Symbol.asyncIterator]() {
    let current = this.from;
    const last = this.to;

    return {
      async next() {
        // 模拟异步延迟
        await new Promise(resolve => setTimeout(resolve, 100));

        if (current <= last) {
          return { value: current++, done: false };
        }
        return { done: true };
      }
    };
  }
};

async function main() {
  for await (const num of asyncRange) {
    console.log(num); // 1, 2, 3, 4, 5（每个间隔 100ms）
  }
}

main();
```

## In Practice: Paginated API Data Fetching

实际项目中经常需要处理分页 API，直到某一页返回空数据。异步迭代器非常适合这种场景：

```js
// 创建一个自动翻页的异步可迭代对象
function paginatedApi(endpoint, pageSize = 20) {
  return {
    [Symbol.asyncIterator]() {
      let page = 1;
      let done = false;

      return {
        async next() {
          if (done) return { done: true };

          const response = await fetch(
            `${endpoint}?page=${page}&pageSize=${pageSize}`
          );
          const data = await response.json();

          if (data.items.length === 0) {
            done = true;
            return { done: true };
          }

          page++;
          return { value: data.items, done: false };
        }
      };
    }
  };
}

// 使用
async function fetchAllUsers() {
  const allUsers = [];

  for await (const users of paginatedApi('/api/users', 50)) {
    allUsers.push(...users);
    console.log(`已加载 ${allUsers.length} 个用户`);
  }

  return allUsers;
}
```

## Simplifying with async generator

`async function*` 是创建异步迭代器更简洁的方式：

```js
// 使用 async generator 重写分页 API
async function* paginatedApi(endpoint, pageSize = 20) {
  let page = 1;

  while (true) {
    const response = await fetch(
      `${endpoint}?page=${page}&pageSize=${pageSize}`
    );
    const data = await response.json();

    if (data.items.length === 0) {
      return; // 结束迭代
    }

    yield data.items; // 产出一批数据
    page++;
  }
}

// 使用方式完全相同
async function main() {
  for await (const users of paginatedApi('/api/users')) {
    console.log(`获取到 ${users.length} 条数据`);
  }
}
```

## In Practice: WebSocket Message Stream

将 WebSocket 的消息流封装为异步可迭代对象：

```js
async function* websocketMessages(url) {
  const ws = new WebSocket(url);

  // 使用队列和 Promise 将事件转换为迭代
  const queue = [];
  let resolve = null;
  let reject = null;

  ws.onmessage = (event) => {
    if (resolve) {
      resolve(JSON.parse(event.data));
      resolve = null;
    } else {
      queue.push(JSON.parse(event.data));
    }
  };

  ws.onerror = (err) => {
    if (reject) {
      reject(err);
    }
  };

  ws.onclose = () => {
    if (resolve) {
      resolve(undefined); // 通知迭代结束
    }
  };

  try {
    while (ws.readyState !== WebSocket.CLOSED) {
      if (queue.length > 0) {
        yield queue.shift();
      } else {
        const message = await new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        if (message === undefined) break;
        yield message;
      }
    }
  } finally {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }
}

// 使用
async function handleChatMessages() {
  for await (const message of websocketMessages('wss://chat.example.com')) {
    console.log(`收到消息: ${message.text}`);

    if (message.type === 'system' && message.action === 'disconnect') {
      break; // 可以随时 break 退出迭代
    }
  }
}
```

## In Practice: Line-by-Line File Reading

Node.js 中读取大文件时，可以使用异步迭代器逐行处理，避免一次性加载到内存：

```js
const fs = require('fs');
const readline = require('readline');

async function* readLines(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  // readline 是可迭代对象，在 Node 10+ 支持 for-await-of
  for await (const line of rl) {
    yield line;
  }
}

// 使用
async function processLogFile() {
  let errorCount = 0;
  let warnCount = 0;

  for await (const line of readLines('/var/log/app.log')) {
    if (line.includes('ERROR')) {
      errorCount++;
      console.error(line);
    } else if (line.includes('WARN')) {
      warnCount++;
    }
  }

  console.log(`统计: ${errorCount} 个错误, ${warnCount} 个警告`);
}
```

## Async Generator Methods

异步生成器也支持 `return()` 和 `throw()` 方法：

```js
async function* dataStream() {
  try {
    yield 1;
    yield 2;
    yield 3;
  } finally {
    // 在迭代中断时执行清理逻辑
    console.log('清理资源');
  }
}

async function main() {
  const stream = dataStream();

  // 正常迭代
  console.log(await stream.next()); // { value: 1, done: false }

  // 提前终止迭代 —— 会触发 finally
  await stream.return(); // 输出: 清理资源
  console.log(await stream.next()); // { done: true }
}
```

## Converting Between Async and Sync Iterators

```js
// 将普通数组包装为异步迭代器
async function* toAsyncIterable(syncIterable) {
  for (const item of syncIterable) {
    yield item;
  }
}

// 添加延迟
async function* delayEach(iterable, ms) {
  for await (const item of iterable) {
    await new Promise(r => setTimeout(r, ms));
    yield item;
  }
}

// 过滤
async function* filter(iterable, predicate) {
  for await (const item of iterable) {
    if (predicate(item)) {
      yield item;
    }
  }
}

// 组合使用
async function main() {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for await (const num of filter(delayEach(numbers, 100), n => n % 2 === 0)) {
    console.log(num); // 2, 4, 6, 8, 10（每个间隔 100ms）
  }
}
```

## Comparison with RxJS

| 特性 | for-await-of | RxJS Observable |
|------|-------------|-----------------|
| 学习成本 | 低（原生语法） | 高（需要学习操作符） |
| 背压控制 | 消费者驱动（天然背压） | 需要额外处理 |
| 操作符 | 需要手动实现 | 丰富的内置操作符 |
| 可取消性 | break / return() | unsubscribe |
| 适用场景 | 简单异步迭代 | 复杂数据流处理 |

## Browser Compatibility

- Chrome 63+、Firefox 57+、Safari 12+、Node 10+
- IE 不支持
- 可以通过 Babel + `@babel/plugin-proposal-async-generator-functions` 编译

## Summary

- 异步迭代器实现了 `Symbol.asyncIterator`，`next()` 返回 Promise
- `for-await-of` 提供了类似同步迭代的语法来处理异步数据流
- `async function*` 是创建异步迭代器最简洁的方式
- 典型场景：分页 API、WebSocket 消息流、文件逐行读取
- 异步迭代器天然支持背压（backpressure），消费者按需拉取数据
- 与 RxJS 相比，学习成本更低，适合不需要复杂操作符的场景
