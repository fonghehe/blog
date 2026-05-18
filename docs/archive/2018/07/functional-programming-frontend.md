---
title: "防抖节流之外：函数式编程思想在前端的应用"
date: 2018-07-03 10:12:42
tags:
  - 前端
readingTime: 2
description: "最近读了一些函数式编程的资料，发现很多思想其实在前端开发里早就在用，只是没有明确意识到。整理一下有实际价值的部分。"
---

最近读了一些函数式编程的资料，发现很多思想其实在前端开发里早就在用，只是没有明确意识到。整理一下有实际价值的部分。

## 纯函数：可预测的函数

纯函数有两个特性：

1. 相同输入永远返回相同输出
2. 没有副作用（不修改外部状态）

```javascript
// ❌ 不是纯函数：结果依赖外部变量
let discount = 0.9;
function getPrice(price) {
  return price * discount; // discount 变化会影响结果
}

// ✅ 纯函数
function getPrice(price, discount) {
  return price * discount; // 相同输入永远相同输出
}
```

纯函数的好处：

- 易于测试（不需要 mock 外部状态）
- 易于缓存（相同输入 = 相同输出，可以记忆化）
- 易于推理（不用担心副作用）

## 函数组合

将多个小函数组合成复杂的数据处理管道：

```javascript
// 原始写法：嵌套调用
const result = sanitize(trim(toLowerCase(input)));

// 函数组合
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

const processInput = pipe(toLowerCase, trim, sanitize);

const result = processInput(input); // 从左到右执行
```

实际应用场景：

```javascript
// 数据处理管道
const processUsers = pipe(
  (users) => users.filter((u) => u.isActive),
  (users) => users.map((u) => ({ ...u, name: u.name.trim() })),
  (users) => users.sort((a, b) => a.name.localeCompare(b.name)),
);

const activeUsers = processUsers(rawUsers);
```

## 柯里化（Currying）

将多参数函数转为单参数函数序列：

```javascript
// 普通函数
function add(a, b) {
  return a + b;
}

// 柯里化
function curriedAdd(a) {
  return function (b) {
    return a + b;
  };
}

// 箭头函数简写
const curriedAdd = (a) => (b) => a + b;

const add5 = curriedAdd(5); // 固定第一个参数
add5(3); // 8
add5(10); // 15
```

实际应用：

```javascript
// 参数化的验证函数
const minLength = (min) => (str) => str.length >= min;
const maxLength = (max) => (str) => str.length <= max;
const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const validators = {
  username: [minLength(3), maxLength(20)],
  email: [isEmail],
  password: [minLength(8)],
};

function validate(value, rules) {
  return rules.every((rule) => rule(value));
}

validate("alice", validators.username); // true
validate("ab", validators.username); // false（太短）
```

## 不可变数据

避免直接修改数据，而是创建新数据：

```javascript
// ❌ 直接修改
function updateUser(user, newName) {
  user.name = newName; // 修改了原对象
  return user;
}

// ✅ 创建新对象
function updateUser(user, newName) {
  return { ...user, name: newName };
}

// 数组操作
// ❌ 直接修改
list.push(newItem);
list.splice(index, 1);

// ✅ 不可变操作
const newList = [...list, newItem];
const filteredList = list.filter((_, i) => i !== index);
```

不可变数据的好处：

- 更容易追踪变化（old 和 new 都有，可以对比）
- Vue/React 的变化检测更可靠
- 时间旅行调试（Redux DevTools）成为可能

## 在 Vue 中应用

```javascript
// 计算属性（纯函数）
computed: {
  filteredList() {
    // 不修改 this.list，返回新数组
    return this.list
      .filter(item => item.status === this.filterStatus)
      .map(item => ({ ...item, label: item.name.toUpperCase() }))
  }
}
```

```javascript
// Vuex mutations 保持不可变性
mutations: {
  UPDATE_USER(state, payload) {
    // ✅ 用展开运算符创建新对象
    state.users = state.users.map(user =>
      user.id === payload.id
        ? { ...user, ...payload.changes }
        : user
    )
  }
}
```

## 小结

函数式思想不需要全盘引入，实用的部分：

- **纯函数**：工具函数尽量写成纯函数，便于测试
- **不可变数据**：状态管理里遵循不可变原则
- **函数组合**：复杂数据处理用 pipe 组织，比嵌套调用清晰
- 不必追求"函数式纯粹"，和命令式混合使用完全没问题
