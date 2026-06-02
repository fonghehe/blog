---
title: "JavaScript 非同步模式演進：從 Promise 到 AsyncIterator"
date: 2026-06-02 10:16:23
tags:
  - JavaScript
readingTime: 2
description: "JavaScript 非同步程式設計經歷了從回呼到 Promise、從 Generator 到 Async/Await 的演進。本文梳理 2026 年的非同步模式全景，包括 AsyncIterator、Observable proposal 和非同步資源管理。"
wordCount: 323
---

JavaScript 的非同步程式設計模型一直在進化。從最早的回呼地獄，到 Promise 的鏈式呼叫，再到 Async/Await 的同步寫法，每一步都在降低非同步代碼的心智負擔。2026 年，非同步模式的邊界已經擴展到串流資料、資源管理和跨執行緒通訊。

## 從回呼到 Promise 的典範轉換

回呼嵌套是早期 Node.js 的標誌性問題。Promise 的出現將非同步操作從「嵌套」變成了「鏈式」：

```javascript
// 回呼地獄
fs.readFile('a.txt', (err, a) => {
  fs.readFile('b.txt', (err, b) => {
    fs.readFile('c.txt', (err, c) => {
      console.log(a, b, c);
    });
  });
});

// Promise 鏈
Promise.all([
  fs.promises.readFile('a.txt'),
  fs.promises.readFile('b.txt'),
  fs.promises.readFile('c.txt')
]).then(([a, b, c]) => console.log(a, b, c));
```

Promise 的核心價值不只是語法改進，而是提供了標準化的錯誤處理和組合能力。

## Async/Await 的同步錯覺

Async/Await 讓非同步代碼看起來像同步代碼，但理解其底層機制很重要：

```javascript
async function fetchUserData(userId) {
  // 這兩行看起來是串行的
  const user = await getUser(userId);       // 可能並行
  const posts = await getPosts(userId);     // 但如果寫在一起，實際是串行

  // 真正的並行應該這樣寫
  const [user, posts] = await Promise.all([
    getUser(userId),
    getPosts(userId)
  ]);

  return { user, posts };
}
```

## AsyncIterator：串流資料的原生支援

AsyncIterator 是處理非同步資料流的現代方案：

```javascript
async function* fetchPages(url) {
  let page = 1;
  while (true) {
    const response = await fetch(`${url}?page=${page}`);
    const data = await response.json();
    if (data.items.length === 0) break;
    yield data.items;
    page++;
  }
}

// 使用 for-await-of 消費
async function processAllItems() {
  for await (const items of fetchPages('/api/products')) {
    for (const item of items) {
      await processItem(item);
    }
  }
}
```

## AbortController：取消非同步操作

```javascript
async function fetchData(url, signal) {
  try {
    const response = await fetch(url, { signal });
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('請求已取消');
    }
    throw err;
  }
}

const controller = new AbortController();
fetchData('/api/data', controller.signal).then(data => {
  console.log(data);
});

// 3秒後取消
setTimeout(() => controller.abort(), 3000);
```

## 結構化並行模式

```javascript
async function processOrder(orderId) {
  const controller = new AbortController();

  try {
    const [payment, inventory] = await Promise.all([
      processPayment(orderId, controller.signal),
      checkInventory(orderId, controller.signal),
    ]);

    return { payment, inventory };
  } catch (err) {
    controller.abort();
    throw err;
  }
}
```

## 小結

JavaScript 非同步模式的演進方向是：更宣告式、更可組合、更易取消。AsyncIterator 處理串流資料，AbortController 處理取消，結構化並行管理生命週期。2026 年的非同步代碼應該做到：能並行就不串行，能串流就不批次，能取消就不浪費資源。
