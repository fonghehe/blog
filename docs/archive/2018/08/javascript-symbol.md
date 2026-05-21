---
title: "JavaScript Symbol 使用场景"
date: 2018-08-28 15:30:12
tags:
  - JavaScript
readingTime: 2
description: "Symbol 是 ES6 新增的基本类型，但很多人不知道什么时候用。来看几个实际场景。"
wordCount: 228
---

Symbol 是 ES6 新增的基本类型，但很多人不知道什么时候用。来看几个实际场景。

## Symbol 的核心特性：唯一性

```javascript
const s1 = Symbol("description");
const s2 = Symbol("description");

console.log(s1 === s2); // false！即使描述相同，也是不同的 Symbol
console.log(typeof s1); // 'symbol'
```

## 场景一：避免对象属性名冲突

当你给一个外部对象（你不拥有的对象）添加属性时，用 Symbol 避免和现有属性冲突：

```javascript
// 给 Array 添加自定义方法（不污染原型）
const customId = Symbol("customId");
const arr = [1, 2, 3];
arr[customId] = "my-array";

// 不会和数组的 length、push 等属性冲突
console.log(arr[customId]); // 'my-array'
console.log(Object.keys(arr)); // ['0', '1', '2']  Symbol 属性不在这里
```

## 场景二：枚举值（防止魔法字符串）

```javascript
// 不用 Symbol：用字符串
const STATUS = {
  PENDING: "pending",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};
// 问题：'pending' 和其他地方的字符串可能意外相等

// 用 Symbol：每个值都是唯一的
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

## 场景三：内部属性，防止外部访问

```javascript
const _private = Symbol("private");

class MyClass {
  constructor() {
    this[_private] = "secret"; // "私有"属性（仍可访问，但不容易碰到）
    this.public = "public";
  }

  getPrivate() {
    return this[_private];
  }
}

const obj = new MyClass();
console.log(obj.public); // 'public'
console.log(obj[_private]); // 'secret'（如果能访问到 _private Symbol）
console.log(Object.keys(obj)); // ['public']（Symbol 不出现在这里）
```

## 内置 Symbol（Well-known Symbols）

JS 引擎内部用 Symbol 定义了很多行为，可以通过覆盖它们来自定义对象行为：

```javascript
// Symbol.iterator：让对象可迭代
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
// Symbol.toPrimitive：自定义类型转换
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
console.log(`价格：${price}`); // '价格：100 CNY'
console.log(price + 50); // 150
console.log(price > 80); // true
```

## Symbol.for：全局共享的 Symbol

```javascript
// Symbol()：每次都是新的
Symbol("key") !== Symbol("key");

// Symbol.for()：相同 key 返回同一个 Symbol（全局注册表）
Symbol.for("key") === Symbol.for("key"); // true

// 用途：跨模块共享同一个 Symbol
// moduleA.js
const MY_KEY = Symbol.for("app:my-key");

// moduleB.js
const MY_KEY = Symbol.for("app:my-key"); // 和 moduleA 的是同一个
```

## 小结

- Symbol 的核心：唯一、不可变
- 场景：避免属性名冲突、唯一枚举值、"私有"属性
- 内置 Symbol：`Symbol.iterator`、`Symbol.toPrimitive` 等可以自定义对象行为
- `Symbol.for`：全局注册，跨模块共享
- Symbol 属性不出现在 `for...in`、`Object.keys()` 中，但 `Reflect.ownKeys()` 可以获取