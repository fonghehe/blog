---
title: "ES6 解构赋值实战"
date: 2018-03-15 14:48:15
tags:
  - ES6
readingTime: 1
description: "解构赋值是 ES6 里我用得最频繁的特性之一，能大幅减少重复代码。整理一下各种用法。"
wordCount: 130
---

解构赋值是 ES6 里我用得最频繁的特性之一，能大幅减少重复代码。整理一下各种用法。

## 数组解构

```javascript
// 基本用法
const [a, b, c] = [1, 2, 3];
console.log(a, b, c); // 1 2 3

// 跳过元素
const [, second, , fourth] = [1, 2, 3, 4];
console.log(second, fourth); // 2 4

// 剩余元素
const [first, ...rest] = [1, 2, 3, 4];
console.log(first); // 1
console.log(rest); // [2, 3, 4]

// 默认值
const [x = 10, y = 20] = [1];
console.log(x, y); // 1 20

// 交换变量（不需要临时变量）
let m = 1,
  n = 2;
[m, n] = [n, m];
console.log(m, n); // 2 1
```

## 对象解构

```javascript
const user = { name: "张三", age: 25, city: "上海" };

// 基本用法
const { name, age } = user;
console.log(name, age); // '张三' 25

// 重命名
const { name: userName, age: userAge } = user;
console.log(userName); // '张三'

// 默认值
const { role = "user", name: uname } = user;
console.log(role); // 'user'（user 对象没有 role 属性，用默认值）

// 嵌套解构
const response = {
  code: 200,
  data: {
    list: [1, 2, 3],
    total: 100,
  },
};
const {
  data: { list, total },
} = response;
console.log(list, total); // [1, 2, 3] 100
```

## 函数参数解构

```javascript
// 不解构
function renderUser(user) {
  return `${user.name}, ${user.age}岁`;
}

// 解构（更清晰）
function renderUser({ name, age }) {
  return `${name}, ${age}岁`;
}

// 带默认值
function createUser({ name, age = 18, role = "user" } = {}) {
  return { name, age, role };
}
createUser({ name: "张三" });
// { name: '张三', age: 18, role: 'user' }
```

## 实际项目场景

```javascript
// API 响应解构
async function fetchUser(id) {
  const {
    data: { name, email, avatar },
    status,
  } = await api.get(`/users/${id}`);
  return { name, email, avatar, status };
}

// Vue 组件里
export default {
  methods: {
    async loadData() {
      const { data: list, total, page } = await this.$api.getList(this.params);
      this.list = list;
      this.total = total;
      this.page = page;
    },
  },
};

// import 时解构（最常用场景）
import { ref, computed, watch, onMounted } from "vue";
import { mapState, mapActions } from "vuex";
```

## 小结

- 数组解构：按位置提取，可用 `...rest` 收集剩余
- 对象解构：按属性名提取，可重命名、设默认值
- 函数参数解构：让参数意图更清晰，支持默认值
- 最常用：import 语句、API 响应处理、函数参数