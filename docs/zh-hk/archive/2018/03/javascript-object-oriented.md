---
title: "JavaScript 面向對象編程：原型鏈與類的設計"
date: 2018-03-30 11:27:27
tags:
  - JavaScript
readingTime: 1
description: "ES6 的 `class` 語法讓 JavaScript 的面向對象寫起來更直觀，但底層依然是原型鏈。理解這兩層抽象，能讓你在選擇繼承方式和調試問題時更有把握。"
wordCount: 223
---

ES6 的 `class` 語法讓 JavaScript 的面向對象寫起來更直觀，但底層依然是原型鏈。理解這兩層抽象，能讓你在選擇繼承方式和調試問題時更有把握。

## 原型鏈基礎

JavaScript 裏每個對象都有一個隱式原型 `[[Prototype]]`，屬性查找會沿着原型鏈向上找：

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  console.log(`${this.name} makes a sound.`);
};

const dog = new Animal("Dog");
dog.speak(); // Dog makes a sound.
console.log(dog.__proto__ === Animal.prototype); // true
```

## ES6 class 語法

`class` 是原型繼承的語法糖，更接近其他語言的寫法：

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    console.log(`${this.name} makes a sound.`);
  }
}

class Dog extends Animal {
  constructor(name) {
    super(name);
  }
  speak() {
    console.log(`${this.name} barks.`);
  }
}

const d = new Dog("Rex");
d.speak(); // Rex barks.
console.log(d instanceof Dog); // true
console.log(d instanceof Animal); // true
```

## 靜態方法與私有字段（Stage 3）

```javascript
class Counter {
  #count = 0; // 私有字段（2018年已是 Stage 3 提案）

  increment() {
    this.#count++;
  }
  get value() {
    return this.#count;
  }

  static create() {
    return new Counter();
  }
}

const c = Counter.create();
c.increment();
console.log(c.value); // 1
// console.log(c.#count); // SyntaxError
```

## 組合 vs 繼承

繼承表達「is-a」關係，組合表達「has-a」關係。過度繼承容易造成緊耦合：

```javascript
// ❌ 過度繼承
class FlyingFishAnimal extends Animal { ... }

// ✅ 組合
const canFly = (base) => class extends base {
  fly() { console.log(`${this.name} is flying`); }
};
const canSwim = (base) => class extends base {
  swim() { console.log(`${this.name} is swimming`); }
};

class FlyingFish extends canFly(canSwim(Animal)) {}
const ff = new FlyingFish('FlyingFish');
ff.fly();  // FlyingFish is flying
ff.swim(); // FlyingFish is swimming
```

## 常見陷阱

**1. this 丟失**

```javascript
class Timer {
  constructor() {
    this.seconds = 0;
  }
  start() {
    // ❌ setTimeout 裏的 this 不是 Timer 實例
    // setTimeout(function() { this.seconds++; }, 1000);
    // ✅ 用箭頭函數
    setTimeout(() => {
      this.seconds++;
    }, 1000);
  }
}
```

**2. 忘記 super()**

```javascript
class Child extends Parent {
  constructor(name) {
    // 必須在 this 賦值之前調用 super()
    super(name); // ✅
    this.extra = "extra";
  }
}
```

## 總結

ES6 class 語法極大地改善了 JavaScript OOP 的可讀性。理解原型鏈是寫好 JS 的基礎，而合理使用組合模式則能避免繼承層級過深帶來的維護問題。
