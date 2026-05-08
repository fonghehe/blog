---
title: "深入理解 JavaScript 闭包"
date: 2018-05-10 10:41:26
tags:
  - JavaScript
---

闭包是 JavaScript 面试必问，但真正理解的人不多。这篇从词法作用域出发，讲清楚什么是闭包，以及实际工程中的应用。

## 词法作用域：闭包的基础

JavaScript 使用词法作用域（也叫静态作用域）：**函数的作用域在函数定义时决定，而不是调用时**。

```javascript
const x = 10;

function outer() {
  const y = 20;

  function inner() {
    const z = 30;
    console.log(x, y, z); // 10, 20, 30
    // inner 能访问 outer 和全局的变量
    // 这由函数定义的位置决定
  }

  inner();
}

outer();
```

## 什么是闭包

**闭包 = 函数 + 其定义时的词法环境**

当内部函数被外部引用，导致外部函数的变量无法被垃圾回收时，就形成了闭包：

```javascript
function makeCounter() {
  let count = 0; // 这个变量会被"关闭"在闭包里

  return function () {
    count++;
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3

// count 变量没有被销毁，因为 counter 函数还引用着它
```

## 经典闭包陷阱

```javascript
// ❌ 经典问题：循环里的闭包
for (var i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // 输出 5 5 5 5 5（不是 0 1 2 3 4）
  }, i * 1000);
}

// 原因：var 没有块级作用域，所有回调函数引用的是同一个 i
// 循环结束时 i = 5，所有回调执行时 i 都是 5
```

**解决方案一：let（推荐）**

```javascript
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // 0 1 2 3 4（每次循环 let 创建新的绑定）
  }, i * 1000);
}
```

**解决方案二：立即执行函数（IIFE）创建新作用域**

```javascript
for (var i = 0; i < 5; i++) {
  (function (j) {
    setTimeout(() => {
      console.log(j); // 0 1 2 3 4
    }, j * 1000);
  })(i);
}
```

## 实际应用场景

### 模块化（封装私有状态）

```javascript
const bankAccount = (function () {
  let balance = 0; // 私有，外部无法直接访问

  return {
    deposit(amount) {
      balance += amount;
      return balance;
    },
    withdraw(amount) {
      if (amount > balance) {
        throw new Error("余额不足");
      }
      balance -= amount;
      return balance;
    },
    getBalance() {
      return balance;
    },
  };
})();

bankAccount.deposit(1000); // 1000
bankAccount.withdraw(200); // 800
bankAccount.getBalance(); // 800
// bankAccount.balance  → undefined（无法直接访问）
```

### 函数工厂

```javascript
function multiply(multiplier) {
  return function (number) {
    return number * multiplier;
  };
}

const double = multiply(2);
const triple = multiply(3);

double(5); // 10
triple(5); // 15
```

### 记忆化（Memoization）

```javascript
function memoize(fn) {
  const cache = new Map(); // 闭包保存缓存

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveFn = memoize(function (n) {
  // 模拟耗时计算
  let result = 0;
  for (let i = 0; i < n * 1000000; i++) result += i;
  return result;
});

expensiveFn(100); // 第一次：慢
expensiveFn(100); // 第二次：瞬间（缓存命中）
```

## 闭包与内存泄漏

闭包会阻止垃圾回收，使用不当导致内存泄漏：

```javascript
function attachHandler() {
  const largeData = new Array(1000000).fill("data");

  document.getElementById("btn").addEventListener("click", function () {
    // 回调函数引用了 largeData，导致其无法被 GC
    console.log(largeData.length);
  });
}
```

**解决：** 使用完后手动取消引用或移除事件监听器：

```javascript
// Vue 组件里
mounted() {
  this.handler = () => { ... }
  element.addEventListener('click', this.handler)
},
beforeDestroy() {
  element.removeEventListener('click', this.handler)  // 清理
}
```

## 小结

- 闭包 = 函数 + 其定义时的词法环境
- 循环里用 `let` 避免经典闭包陷阱
- 闭包用于封装私有状态、函数工厂、记忆化
- 注意不必要的闭包持有大量数据，可能导致内存泄漏
