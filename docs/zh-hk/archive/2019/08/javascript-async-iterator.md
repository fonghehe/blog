---
title: "JavaScript 異步迭代器 for-await-of：落地路徑與實戰建議"
date: 2019-08-21 17:03:21
tags:
  - JavaScript
readingTime: 4
description: "ES2018 引入了異步迭代器（Async Iterator）和 `for-await-of` 語法，讓我們可以用同步的方式處理異步數據流。這個特性在處理分頁 API、WebSocket 消息、檔案流等場景下非常有用。本文將從迭代器協議講起，深入理解異步迭代器的原理和實戰應用。"
wordCount: 584
---

ES2018 引入了異步迭代器（Async Iterator）和 `for-await-of` 語法，讓我們可以用同步的方式處理異步數據流。這個特性在處理分頁 API、WebSocket 消息、文件流等場景下非常有用。本文將從迭代器協議講起，深入理解異步迭代器的原理和實戰應用。

## 回顧：同步迭代器

在理解異步迭代器之前，先回顧同步迭代器。一個對象要可迭代（iterable），需要實現 `Symbol.iterator` 方法：

```js
// 自定義可迭代對象
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

## 異步迭代器協議

異步迭代器與同步迭代器的關鍵區別：

1. 方法名是 `Symbol.asyncIterator` 而非 `Symbol.iterator`
2. `next()` 返回的是 `Promise<{value, done}>` 而非 `{value, done}`
3. 使用 `for-await-of` 而非 `for-of` 進行迭代

```js
const asyncRange = {
  from: 1,
  to: 5,

  [Symbol.asyncIterator]() {
    let current = this.from;
    const last = this.to;

    return {
      async next() {
        // 模擬異步延遲
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
    console.log(num); // 1, 2, 3, 4, 5（每個間隔 100ms）
  }
}

main();
```

## 實戰：分頁 API 數據獲取

實際項目中經常需要處理分頁 API，直到某一頁返回空數據。異步迭代器非常適合這種場景：

```js
// 創建一個自動翻頁的異步可迭代對象
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
    console.log(`已加載 ${allUsers.length} 個用户`);
  }

  return allUsers;
}
```

## 使用 async generator 簡化

`async function*` 是創建異步迭代器更簡潔的方式：

```js
// 使用 async generator 重寫分頁 API
async function* paginatedApi(endpoint, pageSize = 20) {
  let page = 1;

  while (true) {
    const response = await fetch(
      `${endpoint}?page=${page}&pageSize=${pageSize}`
    );
    const data = await response.json();

    if (data.items.length === 0) {
      return; // 結束迭代
    }

    yield data.items; // 產出一批數據
    page++;
  }
}

// 使用方式完全相同
async function main() {
  for await (const users of paginatedApi('/api/users')) {
    console.log(`獲取到 ${users.length} 條數據`);
  }
}
```

## 實戰：WebSocket 消息流

將 WebSocket 的消息流封裝為異步可迭代對象：

```js
async function* websocketMessages(url) {
  const ws = new WebSocket(url);

  // 使用隊列和 Promise 將事件轉換為迭代
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
      resolve(undefined); // 通知迭代結束
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
      break; // 可以隨時 break 退出迭代
    }
  }
}
```

## 實戰：檔案逐行讀取

Node.js 中讀取大文件時，可以使用異步迭代器逐行處理，避免一次性加載到內存：

```js
const fs = require('fs');
const readline = require('readline');

async function* readLines(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  // readline 是可迭代對象，在 Node 10+ 支持 for-await-of
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

  console.log(`統計: ${errorCount} 個錯誤, ${warnCount} 個警告`);
}
```

## 異步生成器的方法

異步生成器也支持 `return()` 和 `throw()` 方法：

```js
async function* dataStream() {
  try {
    yield 1;
    yield 2;
    yield 3;
  } finally {
    // 在迭代中斷時執行清理邏輯
    console.log('清理資源');
  }
}

async function main() {
  const stream = dataStream();

  // 正常迭代
  console.log(await stream.next()); // { value: 1, done: false }

  // 提前終止迭代 —— 會觸發 finally
  await stream.return(); // 輸出: 清理資源
  console.log(await stream.next()); // { done: true }
}
```

## 異步迭代器與普通迭代器的轉換

```js
// 將普通數組包裝為異步迭代器
async function* toAsyncIterable(syncIterable) {
  for (const item of syncIterable) {
    yield item;
  }
}

// 添加延遲
async function* delayEach(iterable, ms) {
  for await (const item of iterable) {
    await new Promise(r => setTimeout(r, ms));
    yield item;
  }
}

// 過濾
async function* filter(iterable, predicate) {
  for await (const item of iterable) {
    if (predicate(item)) {
      yield item;
    }
  }
}

// 組合使用
async function main() {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for await (const num of filter(delayEach(numbers, 100), n => n % 2 === 0)) {
    console.log(num); // 2, 4, 6, 8, 10（每個間隔 100ms）
  }
}
```

## 與 RxJS 的對比

| 特性 | for-await-of | RxJS Observable |
|
------|-------------|-----------------|
| 學習成本 | 低（原生語法） | 高（需要學習操作符） |
| 背壓控製 | 消費者驅動（天然背壓） | 需要額外處理 |
| 操作符 | 需要手動實現 | 豐富的內置操作符 |
| 可取消性 | break / return() | unsubscribe |
| 適用場景 | 簡單異步迭代 | 複雜數據流處理 |

## 瀏覽器相容性

- Chrome 63+、Firefox 57+、Safari 12+、Node 10+
- IE 不支持
- 可以通過 Babel + `@babel/plugin-proposal-async-generator-functions` 編譯

## 小結

- 異步迭代器實現了 `Symbol.asyncIterator`，`next()` 返回 Promise
- `for-await-of` 提供了類似同步迭代的語法來處理異步數據流
- `async function*` 是創建異步迭代器最簡潔的方式
- 典型場景：分頁 API、WebSocket 消息流、文件逐行讀取
- 異步迭代器天然支援背壓（backpressure），消費者按需拉取數據
- 與 RxJS 相比，學習成本更低，適合不需要複雜操作符的場景
