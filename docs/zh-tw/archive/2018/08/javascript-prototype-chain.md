---
title: "JavaScript 原型鏈圖解"
date: 2018-08-09 15:14:28
tags:
  - JavaScript
readingTime: 2
description: "原型鏈是 JavaScript 面向物件的基礎，但很多人學完後還是一團霧水。這篇文章用圖解+程式碼，徹底搞清楚原型鏈。"
wordCount: 224
---

原型鏈是 JavaScript 面向物件的基礎，但很多人學完後還是一團霧水。這篇文章用圖解+程式碼，徹底搞清楚原型鏈。

## 核心概念

JavaScript 裡，每個物件都有一個隱式屬性 `[[Prototype]]`（通過 `__proto__` 或 `Object.getPrototypeOf()` 訪問），指向它的"原型"。屬性查詢時，如果當前物件沒有這個屬性，就沿著原型鏈向上查詢。

## 函式、prototype、**proto** 的關係

```javascript
function Animal(name) {
  this.name = name;
}

Animal.prototype.speak = function () {
  console.log(`${this.name} makes a sound.`);
};

const dog = new Animal("Rex");
```

關係圖：

```
Animal（函式物件）
  │
  ├── Animal.prototype ← dog.__proto__
  │     ├── speak: function
  │     ├── constructor: Animal
  │     └── __proto__ → Object.prototype
  │                         ├── toString
  │                         ├── hasOwnProperty
  │                         └── __proto__ → null
  │
  └── __proto__ → Function.prototype
                     └── __proto__ → Object.prototype
```

用程式碼驗證：

```javascript
dog.__proto__ === Animal.prototype; // true
Animal.prototype.constructor === Animal; // true
Animal.__proto__ === Function.prototype; // true（函式也是物件）
Function.prototype.__proto__ === Object.prototype; // true
Object.prototype.__proto__ === null; // true（鏈的終點）
```

## new 做了什麼

```javascript
const dog = new Animal("Rex");

// 等價於手動實現 new：
function myNew(Constructor, ...args) {
  // 1. 建立新物件，原型指向 Constructor.prototype
  const obj = Object.create(Constructor.prototype);

  // 2. 執行建構函式，this 繫結到新物件
  const result = Constructor.apply(obj, args);

  // 3. 如果建構函式返回物件，返回該物件；否則返回新物件
  return result instanceof Object ? result : obj;
}

const dog2 = myNew(Animal, "Rex");
dog2.speak(); // Rex makes a sound.
```

## 繼承

### ES5 原型繼承

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 繼承屬性
  this.breed = breed;
}

// 建立原型鏈
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog; // 修復 constructor 指向

Dog.prototype.speak = function () {
  return `${this.name} barks`;
};

const rex = new Dog("Rex", "Labrador");
rex.speak(); // Rex barks
rex instanceof Dog; // true
rex instanceof Animal; // true
```

### ES6 class（語法糖）

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} makes a sound`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // 呼叫父類建構函式，等價於 Animal.call(this, name)
    this.breed = breed;
  }
  speak() {
    return `${this.name} barks`;
  }
}

const rex = new Dog("Rex", "Labrador");
// 底層原型鏈和 ES5 方式完全一樣
```

## 屬性查詢規則

```javascript
const animal = { type: "animal" };
const dog = Object.create(animal); // dog.__proto__ === animal
dog.name = "Rex";

const labrador = Object.create(dog);
labrador.breed = "Labrador";

labrador.breed; // 'Labrador'（自身屬性）
labrador.name; // 'Rex'（dog 上的屬性）
labrador.type; // 'animal'（animal 上的屬性）
labrador.xxx; // undefined（查到 Object.prototype 沒找到）

// 檢查自身屬性（不查原型鏈）
labrador.hasOwnProperty("breed"); // true
labrador.hasOwnProperty("name"); // false（在原型上）
```

## 常見面試題

```javascript
function Foo() {}
const foo = new Foo();

// 以下哪個是 true？
foo instanceof Foo; // true
foo instanceof Object; // true
Foo instanceof Function; // true
Foo instanceof Object; // true（函式也是物件）
Function instanceof Object; // true
Object instanceof Function; // true（Object 本身是函式）
```

## 小結

- 每個物件都有 `[[Prototype]]`，屬性查詢沿鏈向上
- 函式有 `prototype` 屬性，例項的 `__proto__` 指向它
- `new` 建立物件，建立原型鏈，執行建構函式
- ES6 `class` 是原型繼承的語法糖，底層機製相同
- 鏈的終點是 `Object.prototype.__proto__ === null`
