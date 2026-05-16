---
title: "ES6 Destructuring Assignment in Practice"
date: 2018-03-15 14:48:15
tags:
  - ES6
readingTime: 1
description: "Destructuring assignment is one of the ES6 features I use most frequently — it dramatically reduces repetitive code. Here's a summary of the various usages."
---

Destructuring assignment is one of the ES6 features I use most frequently — it dramatically reduces repetitive code. Here's a summary of the various usages.

## Array Destructuring

```javascript
// Basic usage
const [a, b, c] = [1, 2, 3];
console.log(a, b, c); // 1 2 3

// Skip elements
const [, second, , fourth] = [1, 2, 3, 4];
console.log(second, fourth); // 2 4

// Rest elements
const [first, ...rest] = [1, 2, 3, 4];
console.log(first); // 1
console.log(rest); // [2, 3, 4]

// Default values
const [x = 10, y = 20] = [1];
console.log(x, y); // 1 20

// Swap variables (no temporary variable needed)
let m = 1,
  n = 2;
[m, n] = [n, m];
console.log(m, n); // 2 1
```

## Object Destructuring

```javascript
const user = { name: "Alice", age: 25, city: "New York" };

// Basic usage
const { name, age } = user;
console.log(name, age); // 'Alice' 25

// Rename
const { name: userName, age: userAge } = user;
console.log(userName); // 'Alice'

// Default values
const { role = "user", name: uname } = user;
console.log(role); // 'user' (user object has no role property, uses default)

// Nested destructuring
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

## Function Parameter Destructuring

```javascript
// Without destructuring
function renderUser(user) {
  return `${user.name}, age ${user.age}`;
}

// With destructuring (clearer)
function renderUser({ name, age }) {
  return `${name}, age ${age}`;
}

// With default values
function createUser({ name, age = 18, role = "user" } = {}) {
  return { name, age, role };
}
createUser({ name: "Alice" });
// { name: 'Alice', age: 18, role: 'user' }
```

## Real Project Scenarios

```javascript
// API response destructuring
async function fetchUser(id) {
  const {
    data: { name, email, avatar },
    status,
  } = await api.get(`/users/${id}`);
  return { name, email, avatar, status };
}

// Inside a Vue component
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

// Destructuring in imports (most common use case)
import { ref, computed, watch, onMounted } from "vue";
import { mapState, mapActions } from "vuex";
```

## Summary

- Array destructuring: extract by position, use `...rest` to collect remaining elements
- Object destructuring: extract by property name, supports renaming and default values
- Function parameter destructuring: makes parameter intent clearer, supports default values
