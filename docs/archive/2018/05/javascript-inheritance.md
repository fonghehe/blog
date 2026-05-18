---
title: "JavaScript 继承的几种方式"
date: 2018-05-24 16:15:02
tags:
  - JavaScript
readingTime: 1
description: "面试必考题，但理解透了也有实际价值。JS 的继承方式很多，各有适用场景。"
---

面试必考题，但理解透了也有实际价值。JS 的继承方式很多，各有适用场景。

## 原型链继承

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} 发出声音`;
};

function Dog(name) {
  this.name = name;
}
Dog.prototype = new Animal(); // 原型链继承

const dog = new Dog("旺财");
dog.speak(); // '旺财 发出声音'
```

**问题**：所有子类实例共享原型上的引用类型属性。

```javascript
function Animal() {
  this.friends = []; // 引用类型
}
Dog.prototype = new Animal();

const d1 = new Dog();
const d2 = new Dog();
d1.friends.push("猫咪");
console.log(d2.friends); // ['猫咪'] ← d2 也被污染了！
```

## 构造函数继承（借用构造函数）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}

function Dog(name, breed) {
  Animal.call(this, name); // 在子类构造函数里调用父类
  this.breed = breed;
}

const d1 = new Dog("旺财", "柴犬");
const d2 = new Dog("小黑", "拉布拉多");
d1.friends.push("猫咪");
console.log(d2.friends); // [] ← 不会相互影响
```

**问题**：无法继承父类原型上的方法（`Animal.prototype.speak` 不可用）。

## 组合继承（最常用的传统方式）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name} 发出声音`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 1. 继承属性
  this.breed = breed;
}
Dog.prototype = new Animal(); // 2. 继承方法
Dog.prototype.constructor = Dog; // 3. 修正 constructor

const dog = new Dog("旺财", "柴犬");
dog.speak(); // ✅ 可以调用父类方法
dog.friends; // ✅ 独立的，不共享
```

**问题**：`Animal` 被调用了两次（性能浪费）。

## Object.create：寄生组合继承（最佳传统方案）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name} 发出声音`;
};

function Dog(name, breed) {
  Animal.call(this, name);
  this.breed = breed;
}

// 关键：不用 new Animal()，避免调用两次父类构造函数
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

// 子类方法
Dog.prototype.bark = function () {
  return "汪汪！";
};
```

## ES6 class（现代方式）

```javascript
class Animal {
  constructor(name) {
    this.name = name;
    this.friends = [];
  }

  speak() {
    return `${this.name} 发出声音`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // 必须先调用 super
    this.breed = breed;
  }

  bark() {
    return "汪汪！";
  }
}

const dog = new Dog("旺财", "柴犬");
dog.speak(); // '旺财 发出声音'
dog.bark(); // '汪汪！'
dog instanceof Animal; // true
dog instanceof Dog; // true
```

## 小结

| 方式      | 继承属性 | 继承方法 | 推荐             |
| 
--------- | -------- | -------- | ---------------- |
| 原型链    | ❌共享   | ✅       | ❌               |
| 构造函数  | ✅       | ❌       | ❌               |
| 组合继承  | ✅       | ✅       | 可用但有性能问题 |
| 寄生组合  | ✅       | ✅       | ✅ ES6 前最佳    |
| ES6 class | ✅       | ✅       | ✅ 现代首选      |

现在写新代码都用 ES6 class，理解原型链继承是为了读懂老代码和面试。