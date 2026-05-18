---
title: "深入理解 JavaScript 閉包"
date: 2018-05-10 10:41:26
tags:
  - JavaScript
readingTime: 2
description: "閉包是 JavaScript 面試必問，但真正理解的人不多。這篇從詞法作用域出發，講清楚什麼是閉包，以及實際工程中的應用。"
---

閉包是 JavaScript 面試必問，但真正理解的人不多。這篇從詞法作用域出發，講清楚什麼是閉包，以及實際工程中的應用。

## 詞法作用域：閉包的基礎

JavaScript 使用詞法作用域（也叫靜態作用域）：**函式的作用域在函式定義時決定，而不是呼叫時**。

```javascript
const x = 10;

function outer() {
  const y = 20;

  function inner() {
    const z = 30;
    console.log(x, y, z); // 10, 20, 30
    // inner 能訪問 outer 和全域性的變數
    // 這由函式定義的位置決定
  }

  inner();
}

outer();
```

## 什麼是閉包

**閉包 = 函式 + 其定義時的詞法環境**

當內部函式被外部引用，導致外部函式的變數無法被垃圾回收時，就形成了閉包：

```javascript
function makeCounter() {
  let count = 0; // 這個變數會被"關閉"在閉包裡

  return function () {
    count++;
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3

// count 變數沒有被銷燬，因為 counter 函式還引用著它
```

## 經典閉包陷阱

```javascript
// ❌ 經典問題：迴圈裡的閉包
for (var i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // 輸出 5 5 5 5 5（不是 0 1 2 3 4）
  }, i * 1000);
}

// 原因：var 沒有塊級作用域，所有回撥函式引用的是同一個 i
// 迴圈結束時 i = 5，所有回撥執行時 i 都是 5
```

**解決方案一：let（推薦）**

```javascript
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // 0 1 2 3 4（每次迴圈 let 建立新的繫結）
  }, i * 1000);
}
```

**解決方案二：立即執行函式（IIFE）建立新作用域**

```javascript
for (var i = 0; i < 5; i++) {
  (function (j) {
    setTimeout(() => {
      console.log(j); // 0 1 2 3 4
    }, j * 1000);
  })(i);
}
```

## 實際應用場景

### 模組化（封裝私有狀態）

```javascript
const bankAccount = (function () {
  let balance = 0; // 私有，外部無法直接訪問

  return {
    deposit(amount) {
      balance += amount;
      return balance;
    },
    withdraw(amount) {
      if (amount > balance) {
        throw new Error("餘額不足");
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
// bankAccount.balance  → undefined（無法直接訪問）
```

### 函式工廠

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

### 記憶化（Memoization）

```javascript
function memoize(fn) {
  const cache = new Map(); // 閉包儲存快取

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
  // 模擬耗時計算
  let result = 0;
  for (let i = 0; i < n * 1000000; i++) result += i;
  return result;
});

expensiveFn(100); // 第一次：慢
expensiveFn(100); // 第二次：瞬間（快取命中）
```

## 閉包與記憶體洩漏

閉包會阻止垃圾回收，使用不當導致記憶體洩漏：

```javascript
function attachHandler() {
  const largeData = new Array(1000000).fill("data");

  document.getElementById("btn").addEventListener("click", function () {
    // 回撥函式引用了 largeData，導致其無法被 GC
    console.log(largeData.length);
  });
}
```

**解決：** 使用完後手動取消引用或移除事件監聽器：

```javascript
// Vue 元件裡
mounted() {
  this.handler = () => { ... }
  element.addEventListener('click', this.handler)
},
beforeDestroy() {
  element.removeEventListener('click', this.handler)  // 清理
}
```

## 小結

- 閉包 = 函式 + 其定義時的詞法環境
- 迴圈裡用 `let` 避免經典閉包陷阱
- 閉包用於封裝私有狀態、函式工廠、記憶化
- 注意不必要的閉包持有大量資料，可能導致記憶體洩漏
