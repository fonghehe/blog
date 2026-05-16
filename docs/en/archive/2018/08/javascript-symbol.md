---
title: "JavaScript Symbol: Practical Use Cases"
date: 2018-08-28 15:30:12
tags:
  - JavaScript
readingTime: 2
description: "Symbol is a primitive type added in ES6, but many developers are unsure when to use it. Here are a few practical scenarios."
---

Symbol is a primitive type added in ES6, but many developers are unsure when to use it. Here are a few practical scenarios.

## Core Characteristic: Uniqueness

```javascript
const s1 = Symbol("description");
const s2 = Symbol("description");

console.log(s1 === s2); // false! Even with the same description, they are different Symbols
console.log(typeof s1); // 'symbol'
```

## Use Case 1: Avoiding Property Name Collisions

When adding properties to an external object (one you don't own), use Symbol to avoid conflicts with existing properties:

```javascript
// Adding a custom method to Array (without polluting the prototype)
const customId = Symbol("customId");
const arr = [1, 2, 3];
arr[customId] = "my-array";

// Won't conflict with array's length, push, etc.
console.log(arr[customId]); // 'my-array'
console.log(Object.keys(arr)); // ['0', '1', '2']  Symbol properties don't appear here
```

## Use Case 2: Enum Values (Preventing Magic Strings)

```javascript
// Without Symbol: using strings
const STATUS = {
  PENDING: "pending",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};
// Problem: 'pending' might accidentally equal strings from elsewhere

// With Symbol: each value is unique
const STATUS = {
  PENDING: Symbol("pending"),
  LOADING: Symbol("loading"),
  SUCCESS: Symbol("success"),
  ERROR: Symbol("error"),
};

let state = STATUS.PENDING;
if (state === STATUS.PENDING) {
  /* only truly PENDING matches */
}
```

## Use Case 3: Internal Properties, Preventing External Access

```javascript
const _private = Symbol("private");

class MyClass {
  constructor() {
    this[_private] = "secret"; // "Private" property (still accessible, but hard to stumble upon)
    this.public = "public";
  }

  getPrivate() {
    return this[_private];
  }
}

const obj = new MyClass();
console.log(obj.public); // 'public'
console.log(obj[_private]); // 'secret' (if you have access to the _private Symbol)
console.log(Object.keys(obj)); // ['public'] (Symbol doesn't show up here)
```

## Well-Known Symbols

The JS engine uses Symbols internally to define many behaviors. You can override them to customize object behavior:

```javascript
// Symbol.iterator: make an object iterable
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
// Symbol.toPrimitive: customize type conversion
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

const price = new Money(100, "USD");
console.log(`Price: ${price}`); // 'Price: 100 USD'
console.log(price + 50); // 150
console.log(price > 80); // true
```

## Symbol.for: Globally Shared Symbols

```javascript
// Symbol(): always creates a new one
Symbol("key") !== Symbol("key");

// Symbol.for(): returns the same Symbol for the same key (global registry)
Symbol.for("key") === Symbol.for("key"); // true

// Use case: sharing the same Symbol across modules
// moduleA.js
const MY_KEY = Symbol.for("app:my-key");

// moduleB.js
const MY_KEY = Symbol.for("app:my-key"); // Same as moduleA's
```

## Summary

- Core of Symbol: unique and immutable
- Use cases: avoiding property name collisions, unique enum values, "private" properties
- Well-known Symbols: `Symbol.iterator`, `Symbol.toPrimitive`, etc. can customize object behavior
- `Symbol.for`: global registry, shareable across modules
- Symbol properties don't appear in `for...in` or `Object.keys()`, but `Reflect.ownKeys()` can retrieve them
