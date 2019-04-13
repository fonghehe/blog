---
title: "JavaScript 函数式编程实践"
date: 2019-04-13 11:22:26
tags:
  - 前端
---

函数式编程在前端圈一直有热度，Redux、RxJS 都有它的影子。整理一些实际能用上的概念。

## 纯函数

```javascript
// 纯函数：相同输入始终相同输出，无副作用
const add = (a, b) => a + b; // ✅ 纯函数

// 非纯函数
let count = 0;
const increment = () => ++count; // ❌ 有副作用

const getDate = () => new Date(); // ❌ 结果不确定
```

纯函数好处：可测试、可缓存、可并行。

## 高阶函数

```javascript
// 接受或返回函数的函数
const map = (fn) => (arr) => arr.map(fn);
const filter = (fn) => (arr) => arr.filter(fn);
const reduce = (fn, init) => (arr) => arr.reduce(fn, init);

const double = (x) => x * 2;
const isEven = (x) => x % 2 === 0;

const numbers = [1, 2, 3, 4, 5];

// 链式处理
const result = numbers
  .filter(isEven) // [2, 4]
  .map(double) // [4, 8]
  .reduce((acc, n) => acc + n, 0); // 12
```

## 柯里化（Currying）

```javascript
// 把多参数函数转为一系列单参数函数
const curry = (fn) => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
};

const add = curry((a, b, c) => a + b + c);

add(1)(2)(3); // 6
add(1, 2)(3); // 6
add(1)(2, 3); // 6

// 实用示例：复用部分参数
const addTax = add(0);
const fivePercentTax = addTax(0.05);

// 配合 map 使用
const prices = [100, 200, 300];
const withTax = prices.map((price) => fivePercentTax(price));
```

## 函数组合

```javascript
// compose：从右到左
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);

// pipe：从左到右（更直观）
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

const trim = (s) => s.trim();
const lower = (s) => s.toLowerCase();
const split = (s) => s.split(" ");

const processInput = pipe(trim, lower, split);
processInput("  Hello World  "); // ['hello', 'world']
```

## 不可变数据

```javascript
// 不直接修改，返回新对象
const state = { user: { name: "Alice", age: 25 }, count: 0 };

// ❌ 直接修改
state.count = 1;
state.user.age = 26;

// ✅ 返回新对象（浅拷贝）
const newState = {
  ...state,
  count: state.count + 1,
  user: { ...state.user, age: 26 },
};

// Immer：更优雅地处理不可变更新
import produce from "immer";

const nextState = produce(state, (draft) => {
  draft.count += 1;
  draft.user.age = 26; // 像直接修改，但返回新对象
});
```

## 在 Redux 中的应用

```javascript
// reducer 就是纯函数 + 不可变更新
function todosReducer(state = [], action) {
  switch (action.type) {
    case "ADD_TODO":
      return [...state, { id: Date.now(), text: action.text, done: false }];

    case "TOGGLE_TODO":
      return state.map((todo) =>
        todo.id === action.id ? { ...todo, done: !todo.done } : todo,
      );

    case "REMOVE_TODO":
      return state.filter((todo) => todo.id !== action.id);

    default:
      return state;
  }
}
```

## 小结

- 纯函数：无副作用，相同输入相同输出，便于测试和缓存
- 柯里化：固定部分参数，创建特化函数
- compose/pipe：组合小函数成大函数
- 不可变数据：不修改原数据，Immer 让写法更自然
- 不必"全函数式"，在合适的地方用这些概念就够了
