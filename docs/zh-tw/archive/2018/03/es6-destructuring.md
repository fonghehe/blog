---
title: "ES6 解構賦值實戰"
date: 2018-03-15 14:48:15
tags:
  - ES6
readingTime: 1
description: "解構賦值是 ES6 裡我用得最頻繁的特性之一，能大幅減少重複程式碼。整理一下各種用法。"
---

解構賦值是 ES6 裡我用得最頻繁的特性之一，能大幅減少重複程式碼。整理一下各種用法。

## 陣列解構

```javascript
// 基本用法
const [a, b, c] = [1, 2, 3];
console.log(a, b, c); // 1 2 3

// 跳過元素
const [, second, , fourth] = [1, 2, 3, 4];
console.log(second, fourth); // 2 4

// 剩餘元素
const [first, ...rest] = [1, 2, 3, 4];
console.log(first); // 1
console.log(rest); // [2, 3, 4]

// 預設值
const [x = 10, y = 20] = [1];
console.log(x, y); // 1 20

// 交換變數（不需要臨時變數）
let m = 1,
  n = 2;
[m, n] = [n, m];
console.log(m, n); // 2 1
```

## 物件解構

```javascript
const user = { name: "張三", age: 25, city: "上海" };

// 基本用法
const { name, age } = user;
console.log(name, age); // '張三' 25

// 重新命名
const { name: userName, age: userAge } = user;
console.log(userName); // '張三'

// 預設值
const { role = "user", name: uname } = user;
console.log(role); // 'user'（user 物件沒有 role 屬性，用預設值）

// 巢狀解構
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

## 函式引數解構

```javascript
// 不解構
function renderUser(user) {
  return `${user.name}, ${user.age}歲`;
}

// 解構（更清晰）
function renderUser({ name, age }) {
  return `${name}, ${age}歲`;
}

// 帶預設值
function createUser({ name, age = 18, role = "user" } = {}) {
  return { name, age, role };
}
createUser({ name: "張三" });
// { name: '張三', age: 18, role: 'user' }
```

## 實際專案場景

```javascript
// API 響應解構
async function fetchUser(id) {
  const {
    data: { name, email, avatar },
    status,
  } = await api.get(`/users/${id}`);
  return { name, email, avatar, status };
}

// Vue 元件裡
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

// import 時解構（最常用場景）
import { ref, computed, watch, onMounted } from "vue";
import { mapState, mapActions } from "vuex";
```

## 小結

- 陣列解構：按位置提取，可用 `...rest` 收集剩餘
- 物件解構：按屬性名提取，可重新命名、設預設值
- 函式引數解構：讓引數意圖更清晰，支援預設值
- 最常用：import 語句、API 響應處理、函式引數