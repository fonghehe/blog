---
title: "手寫 Promise/A+ 規範：落地路徑與實戰建議"
date: 2019-01-08 11:17:13
tags:
  - JavaScript
readingTime: 2
description: "面試高頻題，但自己手寫一遍理解最深。"
wordCount: 108
---

面試高頻題，但自己手寫一遍理解最深。

## Promise/A+ 規範核心

1. Promise 有三個狀態：pending → fulfilled 或 pending → rejected（不可逆）
2. `then` 返回新的 Promise（鏈式調用）
3. 異步處理、值穿透、錯誤捕獲

```javascript
class MyPromise {
  constructor(executor) {
    this.state = "pending";
    this.value = undefined;
    this.reason = undefined;
    this.fulfilledCallbacks = [];
    this.rejectedCallbacks = [];

    const resolve = (value) => {
      if (this.state !== "pending") return;
      this.state = "fulfilled";
      this.value = value;
      this.fulfilledCallbacks.forEach((fn) => fn(value));
    };

    const reject = (reason) => {
      if (this.state !== "pending") return;
      this.state = "rejected";
      this.reason = reason;
      this.rejectedCallbacks.forEach((fn) => fn(reason));
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    // 值穿透
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (e) => {
            throw e;
          };

    return new MyPromise((resolve, reject) => {
      const handleFulfilled = (value) => {
        try {
          const result = onFulfilled(value);
          resolvePromise(result, resolve, reject);
        } catch (e) {
          reject(e);
        }
      };

      const handleRejected = (reason) => {
        try {
          const result = onRejected(reason);
          resolvePromise(result, resolve, reject);
        } catch (e) {
          reject(e);
        }
      };

      if (this.state === "fulfilled") {
        queueMicrotask(() => handleFulfilled(this.value));
      } else if (this.state === "rejected") {
        queueMicrotask(() => handleRejected(this.reason));
      } else {
        this.fulfilledCallbacks.push((v) =>
          queueMicrotask(() => handleFulfilled(v)),
        );
        this.rejectedCallbacks.push((r) =>
          queueMicrotask(() => handleRejected(r)),
        );
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(callback) {
    return this.then(
      (value) => MyPromise.resolve(callback()).then(() => value),
      (reason) =>
        MyPromise.resolve(callback()).then(() => {
          throw reason;
        }),
    );
  }

  static resolve(value) {
    if (value instanceof MyPromise) return value;
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let count = 0;
      promises.forEach((promise, i) => {
        MyPromise.resolve(promise).then((value) => {
          results[i] = value;
          if (++count === promises.length) resolve(results);
        }, reject);
      });
    });
  }
}

// 處理 then 返回的是 Promise 的情況
function resolvePromise(result, resolve, reject) {
  if (result instanceof MyPromise) {
    result.then(resolve, reject);
  } else {
    resolve(result);
  }
}
```

## 驗證

```javascript
const p = new MyPromise((resolve, reject) => {
  setTimeout(() => resolve("hello"), 100);
});

p.then((v) => v + " world")
  .then((v) => {
    throw new Error("oops");
  })
  .catch((e) => console.log("caught:", e.message)) // caught: oops
  .finally(() => console.log("done")); // done

MyPromise.all([MyPromise.resolve(1), MyPromise.resolve(2)]).then(console.log); // [1, 2]
```

## 小結

- Promise 狀態不可逆，pending → fulfilled/rejected
- `then` 返回新 Promise，實現鏈式調用
- 用 `queueMicrotask` 確保異步執行（規範要求）
- `catch` 是 `then(null, onRejected)` 的語法糖
