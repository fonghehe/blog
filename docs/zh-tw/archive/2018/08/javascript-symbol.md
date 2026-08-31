---
title: "JavaScript Symbol 使用場景"
date: 2018-08-28 15:30:12
tags:
  - JavaScript
readingTime: 2
description: "Symbol 是 ES6 新增的基本型別，但很多人不知道什麼時候用。來看幾個實際場景。"
wordCount: 229
---

Symbol 是 ES6 新增的基本型別，但很多人不知道什麼時候用。來看幾個實際場景。

## Symbol 的核心特性：唯一性

```javascript
const s1 = Symbol("description");
const s2 = Symbol("description");

console.log(s1 === s2); // false！即使描述相同，也是不同的 Symbol
console.log(typeof s1); // 'symbol'
```

## 場景一：避免物件屬性名衝突

當你給一個外部物件（你不擁有的物件）新增屬性時，用 Symbol 避免和現有屬性衝突：

```javascript
// 給 Array 新增自定義方法（不汙染原型）
const customId = Symbol("customId");
const arr = [1, 2, 3];
arr[customId] = "my-array";

// 不會和陣列的 length、push 等屬性衝突
console.log(arr[customId]); // 'my-array'
console.log(Object.keys(arr)); // ['0', '1', '2']  Symbol 屬性不在這裡
```

## 場景二：列舉值（防止魔法字串）

```javascript
// 不用 Symbol：用字串
const STATUS = {
  PENDING: "pending",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};
// 問題：'pending' 和其他地方的字串可能意外相等

// 用 Symbol：每個值都是唯一的
const STATUS = {
  PENDING: Symbol("pending"),
  LOADING: Symbol("loading"),
  SUCCESS: Symbol("success"),
  ERROR: Symbol("error"),
};

let state = STATUS.PENDING;
if (state === STATUS.PENDING) {
  /* 只有真正的 PENDING 才匹配 */
}
```

## 場景三：內部屬性，防止外部訪問

```javascript
const _private = Symbol("private");

class MyClass {
  constructor() {
    this[_private] = "secret"; // "私有"屬性（仍可訪問，但不容易碰到）
    this.public = "public";
  }

  getPrivate() {
    return this[_private];
  }
}

const obj = new MyClass();
console.log(obj.public); // 'public'
console.log(obj[_private]); // 'secret'（如果能訪問到 _private Symbol）
console.log(Object.keys(obj)); // ['public']（Symbol 不出現在這裡）
```

## 內建 Symbol（Well-known Symbols）

JS 引擎內部用 Symbol 定義了很多行為，可以通過覆蓋它們來自定義物件行為：

```javascript
// Symbol.iterator：讓物件可迭代
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
console.log([...range]); // [1, 2, 3, 4, 5]
for (const n of range) {
  console.log(n);
}
```

```javascript
// Symbol.toPrimitive：自定義型別轉換
class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }

  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.amount;
    if (hint === "string") return `${this.amount} ${this.currency}`;
    return this.amount; // default
  }
}

const price = new Money(100, "CNY");
console.log(`價格：${price}`); // '價格：100 CNY'
console.log(price + 50); // 150
console.log(price > 80); // true
```

## Symbol.for：全域性共享的 Symbol

```javascript
// Symbol()：每次都是新的
Symbol("key") !== Symbol("key");

// Symbol.for()：相同 key 返回同一個 Symbol（全域性登錄檔）
Symbol.for("key") === Symbol.for("key"); // true

// 用途：跨模組共享同一個 Symbol
// moduleA.js
const MY_KEY = Symbol.for("app:my-key");

// moduleB.js
const MY_KEY = Symbol.for("app:my-key"); // 和 moduleA 的是同一個
```

## 小結

- Symbol 的核心：唯一、不可變
- 場景：避免屬性名衝突、唯一列舉值、"私有"屬性
- 內建 Symbol：`Symbol.iterator`、`Symbol.toPrimitive` 等可以自定義物件行為
- `Symbol.for`：全域性註冊，跨模組共享
- Symbol 屬性不出現在 `for...in`、`Object.keys()` 中，但 `Reflect.ownKeys()` 可以獲取