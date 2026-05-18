---
title: "Promise 鏈式呼叫和錯誤處理"
date: 2018-04-24 15:30:06
tags:
  - JavaScript
readingTime: 1
description: "之前寫了 Promise 基礎，這次專門說鏈式呼叫和錯誤處理，這塊容易出細節問題。"
---

之前寫了 Promise 基礎，這次專門說鏈式呼叫和錯誤處理，這塊容易出細節問題。

## 鏈式呼叫基礎

```javascript
// then 返回新的 Promise，可以鏈式
fetchUser(1)
  .then((user) => fetchOrders(user.id)) // 返回新 Promise
  .then((orders) => fetchDetails(orders)) // 繼續鏈
  .then((details) => {
    console.log(details);
  })
  .catch((err) => {
    console.error("任何一步出錯都會到這裡", err);
  });
```

關鍵：`then` 的回撥返回什麼，下一個 `then` 就接到什麼。

```javascript
Promise.resolve(1)
  .then((v) => v + 1) // 返回普通值 2
  .then((v) => v * 2) // 返回普通值 4
  .then((v) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(v + 10), 1000);
    });
  }) // 返回 Promise，等待它完成
  .then((v) => console.log(v)); // 14（1秒後）
```

## 錯誤處理的幾種方式

```javascript
// 方式一：鏈末尾的 .catch（推薦）
fetchUser(1)
  .then(processUser)
  .then(saveUser)
  .catch((err) => {
    // 鏈中任何一個 rejection 都會跳到這裡
    console.error(err);
  });

// 方式二：每個 then 的第二個引數（不推薦，容易漏掉）
fetchUser(1)
  .then(processUser, (err) => console.error("fetchUser 失敗"))
  .then(saveUser, (err) => console.error("processUser 失敗"));

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

## 常見陷阱

**陷阱一：catch 之後鏈還在繼續**

```javascript
fetchUser(1)
  .catch((err) => {
    console.error(err);
    // 沒有 return，後續 then 收到 undefined
    // 如果 return，後續 then 收到返回值
    // 如果 throw，後續 then 跳過，catch 接住
  })
  .then((result) => {
    // 即使前面有錯誤，這裡還是會執行！
    console.log(result); // undefined（因為 catch 沒有 return）
  });
```

**陷阱二：忘記 return**

```javascript
// 錯：沒有 return，下一步收到 undefined
fetchUser(1)
  .then((user) => {
    fetchOrders(user.id); // 沒有 return！
  })
  .then((orders) => {
    console.log(orders); // undefined
  });

// 對
fetchUser(1)
  .then((user) => {
    return fetchOrders(user.id); // return 是關鍵
  })
  .then((orders) => {
    console.log(orders); // 正確的 orders 資料
  });
```

**陷阱三：Promise 構造函數里的同步錯誤**

```javascript
const p = new Promise((resolve, reject) => {
  throw new Error("同步錯誤"); // 這個會被 Promise 捕獲，變成 rejection
});

p.catch((err) => console.error(err)); // '同步錯誤'
```

## 併發控制

```javascript
// 全部併發，全部完成才繼續
const [users, orders, products] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
]);

// 最快的那個
const result = await Promise.race([
  fetchWithTimeout(5000),
  new Promise((_, reject) => setTimeout(() => reject("超時"), 5000)),
]);

// 全部完成，不管成功失敗（ES2020）
const results = await Promise.allSettled([
  fetchUsers(),
  fetchOrders(), // 即使這個失敗，也不影響整體
]);
```

## 小結

- `then` 可以返回值或 Promise，鏈式傳遞
- `catch` 在鏈末尾，捕獲前面任何錯誤
- 常見陷阱：忘記 `return`、`catch` 後鏈繼續執行
- 併發：`Promise.all`（全部成功）、`Promise.allSettled`（不管成敗）