---
title: "JavaScript 繼承的幾種方式"
date: 2018-05-24 16:15:02
tags:
  - JavaScript
readingTime: 1
description: "面試必考題，但理解透了也有實際價值。JS 的繼承方式很多，各有適用場景。"
---

面試必考題，但理解透了也有實際價值。JS 的繼承方式很多，各有適用場景。

## 原型鏈繼承

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} 發出聲音`;
};

function Dog(name) {
  this.name = name;
}
Dog.prototype = new Animal(); // 原型鏈繼承

const dog = new Dog("旺財");
dog.speak(); // '旺財 發出聲音'
```

**問題**：所有子類例項共享原型上的引用型別屬性。

```javascript
function Animal() {
  this.friends = []; // 引用型別
}
Dog.prototype = new Animal();

const d1 = new Dog();
const d2 = new Dog();
d1.friends.push("貓咪");
console.log(d2.friends); // ['貓咪'] ← d2 也被汙染了！
```

## 建構函式繼承（借用建構函式）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}

function Dog(name, breed) {
  Animal.call(this, name); // 在子類構造函數里呼叫父類
  this.breed = breed;
}

const d1 = new Dog("旺財", "柴犬");
const d2 = new Dog("小黑", "拉布拉多");
d1.friends.push("貓咪");
console.log(d2.friends); // [] ← 不會相互影響
```

**問題**：無法繼承父類原型上的方法（`Animal.prototype.speak` 不可用）。

## 組合繼承（最常用的傳統方式）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name} 發出聲音`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 1. 繼承屬性
  this.breed = breed;
}
Dog.prototype = new Animal(); // 2. 繼承方法
Dog.prototype.constructor = Dog; // 3. 修正 constructor

const dog = new Dog("旺財", "柴犬");
dog.speak(); // ✅ 可以呼叫父類方法
dog.friends; // ✅ 獨立的，不共享
```

**問題**：`Animal` 被呼叫了兩次（效能浪費）。

## Object.create：寄生組合繼承（最佳傳統方案）

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name} 發出聲音`;
};

function Dog(name, breed) {
  Animal.call(this, name);
  this.breed = breed;
}

// 關鍵：不用 new Animal()，避免呼叫兩次父類建構函式
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

// 子類方法
Dog.prototype.bark = function () {
  return "汪汪！";
};
```

## ES6 class（現代方式）

```javascript
class Animal {
  constructor(name) {
    this.name = name;
    this.friends = [];
  }

  speak() {
    return `${this.name} 發出聲音`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // 必須先呼叫 super
    this.breed = breed;
  }

  bark() {
    return "汪汪！";
  }
}

const dog = new Dog("旺財", "柴犬");
dog.speak(); // '旺財 發出聲音'
dog.bark(); // '汪汪！'
dog instanceof Animal; // true
dog instanceof Dog; // true
```

## 小結

| 方式      | 繼承屬性 | 繼承方法 | 推薦             |
| 
--------- | -------- | -------- | ---------------- |
| 原型鏈    | ❌共享   | ✅       | ❌               |
| 建構函式  | ✅       | ❌       | ❌               |
| 組合繼承  | ✅       | ✅       | 可用但有效能問題 |
| 寄生組合  | ✅       | ✅       | ✅ ES6 前最佳    |
| ES6 class | ✅       | ✅       | ✅ 現代首選      |

現在寫新程式碼都用 ES6 class，理解原型鏈繼承是為了讀懂老程式碼和麵試。