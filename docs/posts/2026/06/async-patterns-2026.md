---
title: "JavaScript 异步模式演进：从 Promise 到 AsyncIterator"
date: 2026-06-02 10:16:23
tags:
  - JavaScript
  - 异步编程
  - ES6
readingTime: 4
description: "JavaScript 异步编程经历了从回调到 Promise、从 Generator 到 Async/Await 的演进。本文梳理 2026 年的异步模式全景，包括 AsyncIterator、Observable proposal 和异步资源管理。"
wordCount: 799
---

JavaScript 的异步编程模型一直在进化。从最早的回调地狱，到 Promise 的链式调用，再到 Async/Await 的同步写法，每一步都在降低异步代码的心智负担。2026 年，异步模式的边界已经扩展到流式数据、资源管理和跨线程通信。

## 回调到 Promise 的范式转换

回调嵌套是早期 Node.js 的标志性问题。Promise 的出现将异步操作从"嵌套"变成了"链式"：

```javascript
// 回调地狱
fs.readFile('a.txt', (err, a) => {
  fs.readFile('b.txt', (err, b) => {
    fs.readFile('c.txt', (err, c) => {
      console.log(a, b, c);
    });
  });
});

// Promise 链
Promise.all([
  fs.promises.readFile('a.txt'),
  fs.promises.readFile('b.txt'),
  fs.promises.readFile('c.txt')
]).then(([a, b, c]) => console.log(a, b, c));
```

Promise 的核心价值不只是语法改进，而是提供了标准化的错误处理和组合能力。`Promise.all`、`Promise.race`、`Promise.allSettled` 让并发控制变得声明式。

## Async/Await 的同步错觉

Async/Await 让异步代码看起来像同步代码，但理解其底层机制很重要：

```javascript
async function fetchUserData(userId) {
  // 这两行看起来是串行的
  const user = await getUser(userId);       // 可能并行
  const posts = await getPosts(userId);     // 但如果写在一起，实际是串行

  // 真正的并行应该这样写
  const [user, posts] = await Promise.all([
    getUser(userId),
    getPosts(userId)
  ]);

  return { user, posts };
}
```

2026 年的常见陷阱：过度使用 `await` 导致不必要的串行执行。原则是——**只有当后续代码依赖当前结果时才需要 `await`**。

## AsyncIterator：流式数据的原生支持

AsyncIterator 是处理异步数据流的现代方案，特别适合实时数据、分页加载和事件流：

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

// 使用 for-await-of 消费
async function processAllItems() {
  for await (const items of fetchPages('/api/products')) {
    for (const item of items) {
      await processItem(item);
    }
  }
}
```

AsyncIterator 的优势在于**惰性求值**——数据按需生成，不会一次性加载到内存。对于大数据集或无限流，这比 Promise 数组更实用。

## AbortController：取消异步操作

异步操作的取消一直是个难题。`AbortController` 提供了标准化的取消机制：

```javascript
async function fetchData(url, signal) {
  try {
    const response = await fetch(url, { signal });
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('请求已取消');
    }
    throw err;
  }
}

// 使用
const controller = new AbortController();
fetchData('/api/data', controller.signal).then(data => {
  console.log(data);
});

// 3秒后取消
setTimeout(() => controller.abort(), 3000);
```

2026 年的最佳实践：所有异步操作都应该支持 `AbortController`，特别是网络请求和长时间运行的计算。

## Promise.any 与错误聚合

`Promise.any` 在多个异步操作中返回第一个成功的值，与 `Promise.race`（返回第一个完成的值）不同：

```javascript
async function fetchWithFallback(urls) {
  try {
    const result = await Promise.any(
      urls.map(url => fetch(url).then(r => r.json()))
    );
    return result;
  } catch (err) {
    // 所有 Promise 都失败时抛出 AggregateError
    console.log('所有源都失败:', err.errors);
    throw err;
  }
}
```

`AggregateError` 包含所有失败原因，方便调试和重试逻辑。

## 结构化并发模式

2026 年的异步代码更强调"结构化并发"——确保所有异步操作都在明确的作用域内管理：

```javascript
async function processOrder(orderId) {
  // 使用 AbortController 管理生命周期
  const controller = new AbortController();

  try {
    // 并行执行多个异步任务
    const [payment, inventory] = await Promise.all([
      processPayment(orderId, controller.signal),
      checkInventory(orderId, controller.signal),
    ]);

    return { payment, inventory };
  } catch (err) {
    controller.abort(); // 取消所有相关操作
    throw err;
  }
}
```

结构化并发的核心原则：**异步操作的创建和取消应该在同一个作用域内**。

## 异步资源管理

2026 年的新提案 `using` 关键字（Explicit Resource Management）为异步资源提供了自动清理：

```javascript
async function queryDatabase() {
  using connection = await db.getConnection();
  // 连接在作用域结束时自动释放

  const result = await connection.query('SELECT * FROM users');
  return result;
}
```

这个模式解决了"打开资源后忘记关闭"的问题，类似 Python 的 `with` 语句。

## 性能考量

异步模式的选择会影响性能。关键原则：

1. **能并行就并行**：多个独立的异步操作用 `Promise.all`
2. **能流式就流式**：大数据集用 AsyncIterator 而不是一次性加载
3. **能取消就取消**：用户操作取消时及时释放资源
4. **能批量就批量**：减少异步操作次数，比如批量数据库查询

```javascript
// 不好的做法：循环内逐个等待
for (const id of userIds) {
  const user = await getUser(id);  // 串行，慢
}

// 好的做法：批量并行
const users = await Promise.all(
  userIds.map(id => getUser(id))
);  // 并行，快
```

## 小结

JavaScript 异步模式的演进方向是：更声明式、更可组合、更易取消。AsyncIterator 处理流式数据，AbortController 处理取消，结构化并发管理生命周期。2026 年的异步代码应该做到：能并行就不串行，能流式就不批量，能取消就不浪费资源。理解这些模式的适用场景，比记住语法更重要。
