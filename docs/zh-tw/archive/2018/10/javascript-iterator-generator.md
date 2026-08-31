---
title: "JavaScript 迭代器和生成器"
date: 2018-10-11 14:38:00
tags:
  - JavaScript
readingTime: 2
description: "ES6 的迭代器（Iterator）和生成器（Generator）是實現自定義迭代的工具，在 Vuex、Redux-Saga 裡都用到了生成器。"
wordCount: 247
---

ES6 的迭代器（Iterator）和生成器（Generator）是實現自定義迭代的工具，在 Vuex、Redux-Saga 裡都用到了生成器。

## 迭代器協議

迭代器是一個有 `next()` 方法的物件，每次呼叫返回 `{ value, done }`：

```javascript
// 手寫一個迭代器
function createRangeIterator(start, end) {
  let current = start;
  return {
    next() {
      if (current <= end) {
        return { value: current++, done: false };
      }
      return { value: undefined, done: true };
    },
  };
}

const iter = createRangeIterator(1, 3);
iter.next(); // { value: 1, done: false }
iter.next(); // { value: 2, done: false }
iter.next(); // { value: 3, done: false }
iter.next(); // { value: undefined, done: true }
```

## 可迭代協議

實現了 `Symbol.iterator` 方法的物件是可迭代的，可以用 `for...of`、展開運算子等：

```javascript
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}

const range = new Range(1, 5);
for (const n of range) {
  console.log(n);
} // 1 2 3 4 5
console.log([...range]); // [1, 2, 3, 4, 5]
const [first, second] = range; // 解構
```

## 生成器（Generator）

生成器用 `function*` 宣告，`yield` 暫停執行：

```javascript
function* range(start, end) {
  for (let i = start; i <= end; i++) {
    yield i; // 暫停，返回 i，等待下次 next()
  }
}

const gen = range(1, 3);
gen.next(); // { value: 1, done: false }
gen.next(); // { value: 2, done: false }
gen.next(); // { value: 3, done: false }
gen.next(); // { value: undefined, done: true }

// 生成器返回的是可迭代物件
for (const n of range(1, 5)) {
  console.log(n);
}
```

## yield 雙向通訊

`yield` 不只是返回值，還可以接收值：

```javascript
function* logger() {
  while (true) {
    const input = yield; // 暫停，等待外部傳值
    console.log("[LOG]", input);
  }
}

const log = logger();
log.next(); // 啟動生成器（到第一個 yield 暫停）
log.next("第一條日誌"); // 傳入值，繼續執行
log.next("第二條日誌");
```

## 實際應用：async/await 的底層

`async/await` 本質上是生成器 + Promise 的語法糖：

```javascript
// 生成器版本
function* fetchUser(id) {
  const user = yield fetch(`/api/users/${id}`).then((r) => r.json());
  const orders = yield fetch(`/api/orders?userId=${user.id}`).then((r) =>
    r.json(),
  );
  return { user, orders };
}

// 需要一個"執行器"來驅動生成器
// (co 庫就是做這個事情的)

// async/await 版本（等價，但更簡潔）
async function fetchUser(id) {
  const user = await fetch(`/api/users/${id}`).then((r) => r.json());
  const orders = await fetch(`/api/orders?userId=${user.id}`).then((r) =>
    r.json(),
  );
  return { user, orders };
}
```

## Redux-Saga 的生成器

```javascript
// redux-saga 用生成器寫非同步流程
function* fetchUserSaga(action) {
  try {
    const user = yield call(fetchUser, action.id); // call：呼叫非同步函式
    yield put({ type: "FETCH_USER_SUCCESS", user }); // put：dispatch action
  } catch (e) {
    yield put({ type: "FETCH_USER_FAILURE", error: e.message });
  }
}
```

這讓非同步流程的測試變得很容易（只需要檢查 effect 物件，不需要真的執行非同步操作）。

## 小結

- 迭代器協議：`next()` 返回 `{ value, done }`
- 可迭代協議：實現 `[Symbol.iterator]`，支援 `for...of`、解構、展開
- 生成器：`function*` + `yield`，簡化迭代器的編寫
- async/await 是生成器 + Promise 的語法糖
