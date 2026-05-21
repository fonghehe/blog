---
title: "JavaScript 迭代器和生成器"
date: 2018-10-11 14:38:00
tags:
  - JavaScript
readingTime: 2
description: "ES6 的迭代器（Iterator）和生成器（Generator）是实现自定义迭代的工具，在 Vuex、Redux-Saga 里都用到了生成器。"
wordCount: 245
---

ES6 的迭代器（Iterator）和生成器（Generator）是实现自定义迭代的工具，在 Vuex、Redux-Saga 里都用到了生成器。

## 迭代器协议

迭代器是一个有 `next()` 方法的对象，每次调用返回 `{ value, done }`：

```javascript
// 手写一个迭代器
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

## 可迭代协议

实现了 `Symbol.iterator` 方法的对象是可迭代的，可以用 `for...of`、展开运算符等：

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
const [first, second] = range; // 解构
```

## 生成器（Generator）

生成器用 `function*` 声明，`yield` 暂停执行：

```javascript
function* range(start, end) {
  for (let i = start; i <= end; i++) {
    yield i; // 暂停，返回 i，等待下次 next()
  }
}

const gen = range(1, 3);
gen.next(); // { value: 1, done: false }
gen.next(); // { value: 2, done: false }
gen.next(); // { value: 3, done: false }
gen.next(); // { value: undefined, done: true }

// 生成器返回的是可迭代对象
for (const n of range(1, 5)) {
  console.log(n);
}
```

## yield 双向通信

`yield` 不只是返回值，还可以接收值：

```javascript
function* logger() {
  while (true) {
    const input = yield; // 暂停，等待外部传值
    console.log("[LOG]", input);
  }
}

const log = logger();
log.next(); // 启动生成器（到第一个 yield 暂停）
log.next("第一条日志"); // 传入值，继续执行
log.next("第二条日志");
```

## 实际应用：async/await 的底层

`async/await` 本质上是生成器 + Promise 的语法糖：

```javascript
// 生成器版本
function* fetchUser(id) {
  const user = yield fetch(`/api/users/${id}`).then((r) => r.json());
  const orders = yield fetch(`/api/orders?userId=${user.id}`).then((r) =>
    r.json(),
  );
  return { user, orders };
}

// 需要一个"执行器"来驱动生成器
// (co 库就是做这个事情的)

// async/await 版本（等价，但更简洁）
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
// redux-saga 用生成器写异步流程
function* fetchUserSaga(action) {
  try {
    const user = yield call(fetchUser, action.id); // call：调用异步函数
    yield put({ type: "FETCH_USER_SUCCESS", user }); // put：dispatch action
  } catch (e) {
    yield put({ type: "FETCH_USER_FAILURE", error: e.message });
  }
}
```

这让异步流程的测试变得很容易（只需要检查 effect 对象，不需要真的执行异步操作）。

## 小结

- 迭代器协议：`next()` 返回 `{ value, done }`
- 可迭代协议：实现 `[Symbol.iterator]`，支持 `for...of`、解构、展开
- 生成器：`function*` + `yield`，简化迭代器的编写
- async/await 是生成器 + Promise 的语法糖
