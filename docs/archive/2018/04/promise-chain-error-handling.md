---
title: "Promise 链式调用和错误处理"
date: 2018-04-24 15:30:06
tags:
  - JavaScript
---

之前写了 Promise 基础，这次专门说链式调用和错误处理，这块容易出细节问题。

## 链式调用基础

```javascript
// then 返回新的 Promise，可以链式
fetchUser(1)
  .then((user) => fetchOrders(user.id)) // 返回新 Promise
  .then((orders) => fetchDetails(orders)) // 继续链
  .then((details) => {
    console.log(details);
  })
  .catch((err) => {
    console.error("任何一步出错都会到这里", err);
  });
```

关键：`then` 的回调返回什么，下一个 `then` 就接到什么。

```javascript
Promise.resolve(1)
  .then((v) => v + 1) // 返回普通值 2
  .then((v) => v * 2) // 返回普通值 4
  .then((v) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(v + 10), 1000);
    });
  }) // 返回 Promise，等待它完成
  .then((v) => console.log(v)); // 14（1秒后）
```

## 错误处理的几种方式

```javascript
// 方式一：链末尾的 .catch（推荐）
fetchUser(1)
  .then(processUser)
  .then(saveUser)
  .catch((err) => {
    // 链中任何一个 rejection 都会跳到这里
    console.error(err);
  });

// 方式二：每个 then 的第二个参数（不推荐，容易漏掉）
fetchUser(1)
  .then(processUser, (err) => console.error("fetchUser 失败"))
  .then(saveUser, (err) => console.error("processUser 失败"));

// 方式三：async/await + try/catch（最清晰）
async function handleUser() {
  try {
    const user = await fetchUser(1);
    const processed = await processUser(user);
    await saveUser(processed);
  } catch (err) {
    console.error(err);
  }
}
```

## 常见陷阱

**陷阱一：catch 之后链还在继续**

```javascript
fetchUser(1)
  .catch((err) => {
    console.error(err);
    // 没有 return，后续 then 收到 undefined
    // 如果 return，后续 then 收到返回值
    // 如果 throw，后续 then 跳过，catch 接住
  })
  .then((result) => {
    // 即使前面有错误，这里还是会执行！
    console.log(result); // undefined（因为 catch 没有 return）
  });
```

**陷阱二：忘记 return**

```javascript
// 错：没有 return，下一步收到 undefined
fetchUser(1)
  .then((user) => {
    fetchOrders(user.id); // 没有 return！
  })
  .then((orders) => {
    console.log(orders); // undefined
  });

// 对
fetchUser(1)
  .then((user) => {
    return fetchOrders(user.id); // return 是关键
  })
  .then((orders) => {
    console.log(orders); // 正确的 orders 数据
  });
```

**陷阱三：Promise 构造函数里的同步错误**

```javascript
const p = new Promise((resolve, reject) => {
  throw new Error("同步错误"); // 这个会被 Promise 捕获，变成 rejection
});

p.catch((err) => console.error(err)); // '同步错误'
```

## 并发控制

```javascript
// 全部并发，全部完成才继续
const [users, orders, products] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
]);

// 最快的那个
const result = await Promise.race([
  fetchWithTimeout(5000),
  new Promise((_, reject) => setTimeout(() => reject("超时"), 5000)),
]);

// 全部完成，不管成功失败（ES2020）
const results = await Promise.allSettled([
  fetchUsers(),
  fetchOrders(), // 即使这个失败，也不影响整体
]);
```

## 小结

- `then` 可以返回值或 Promise，链式传递
- `catch` 在链末尾，捕获前面任何错误
- 常见陷阱：忘记 `return`、`catch` 后链继续执行
- 并发：`Promise.all`（全部成功）、`Promise.allSettled`（不管成败）