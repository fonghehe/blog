---
title: "JavaScript Async Iterators and for-await-of"
date: 2019-08-21 17:03:21
tags:
  - JavaScript
readingTime: 4
description: "ES2018 introduced async iterators (Async Iterator) and the `for-await-of` syntax, letting us process asynchronous data streams in a style that looks synchronous. This feature is especially useful for paginated APIs, WebSocket message streams, file streams, and similar scenarios. Starting from the iterator protocol, this article dives into how async iterators work and how to use them in practice."
wordCount: 369
---

ES2018 introduced async iterators (Async Iterator) and the `for-await-of` syntax, letting us process asynchronous data streams in a style that looks synchronous. This feature is especially useful for paginated APIs, WebSocket message streams, file streams, and similar scenarios. Starting from the iterator protocol, this article dives into how async iterators work and how to use them in practice.

## Review: Synchronous Iterators

Before async iterators, let's revisit synchronous ones. For an object to be iterable, it must implement the `Symbol.iterator` method:

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

The key differences between async and sync iterators:

1. The method is `Symbol.asyncIterator` instead of `Symbol.iterator`.
2. `next()` returns a `Promise<{value, done}>` instead of `{value, done}`.
3. You iterate with `for-await-of` instead of `for-of`.

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

In real projects you often need to page through an API until some page returns empty data. Async iterators fit this scenario perfectly:

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

## Simplifying with Async Generators

`async function*` is a more concise way to create an async iterator:

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

Wrap a WebSocket message stream as an async iterable:

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

When reading large files in Node.js, you can process them line by line with an async iterator, avoiding loading the whole file into memory at once:

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

Async generators also support the `return()` and `throw()` methods:

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

| Feature | for-await-of | RxJS Observable |
|------|-------------|-----------------|
| Learning curve | Low (native syntax) | High (need to learn operators) |
| Backpressure | Consumer-driven (natural backpressure) | Requires extra handling |
| Operators | Must implement manually | Rich built-in operators |
| Cancellability | break / return() | unsubscribe |
| Best for | Simple async iteration | Complex data stream processing |

## Browser Compatibility

- Chrome 63+, Firefox 57+, Safari 12+, Node 10+
- IE not supported
- Can be transpiled via Babel + `@babel/plugin-proposal-async-generator-functions`

## Summary

- An async iterator implements `Symbol.asyncIterator`, and its `next()` returns a Promise.
- `for-await-of` gives you a syntax much like synchronous iteration for processing async data streams.
- `async function*` is the most concise way to create an async iterator.
- Typical use cases: paginated APIs, WebSocket message streams, and line-by-line file reading.
- Async iterators support backpressure naturally—the consumer pulls data on demand.
- Compared with RxJS, the learning curve is lower, making it a good fit when you don't need complex operators.
