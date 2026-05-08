---
title: "JavaScript 面向对象编程：原型链与类的设计"
date: 2018-03-30 11:27:27
tags:
  - JavaScript
---

ES6 的 `class` 语法让 JavaScript 的面向对象写起来更直观，但底层依然是原型链。理解这两层抽象，能让你在选择继承方式和调试问题时更有把握。

## 原型链基础

JavaScript 里每个对象都有一个隐式原型 `[[Prototype]]`，属性查找会沿着原型链向上找：

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

## ES6 class 语法

`class` 是原型继承的语法糖，更接近其他语言的写法：

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

## 静态方法与私有字段（Stage 3）

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

## 组合 vs 继承

继承表达「is-a」关系，组合表达「has-a」关系。过度继承容易造成紧耦合：

```javascript
// ❌ 过度继承
class FlyingFishAnimal extends Animal { ... }

// ✅ 组合
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

## 常见陷阱

**1. this 丢失**

```javascript
class Timer {
  constructor() {
    this.seconds = 0;
  }
  start() {
    // ❌ setTimeout 里的 this 不是 Timer 实例
    // setTimeout(function() { this.seconds++; }, 1000);
    // ✅ 用箭头函数
    setTimeout(() => {
      this.seconds++;
    }, 1000);
  }
}
```

**2. 忘记 super()**

```javascript
class Child extends Parent {
  constructor(name) {
    // 必须在 this 赋值之前调用 super()
    super(name); // ✅
    this.extra = "extra";
  }
}
```

## 总结

ES6 class 语法极大地改善了 JavaScript OOP 的可读性。理解原型链是写好 JS 的基础，而合理使用组合模式则能避免继承层级过深带来的维护问题。
