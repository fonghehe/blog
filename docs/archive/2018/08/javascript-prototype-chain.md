---
title: "JavaScript 原型链图解"
date: 2018-08-09 15:14:28
tags:
  - JavaScript
readingTime: 2
description: "原型链是 JavaScript 面向对象的基础，但很多人学完后还是一团雾水。这篇文章用图解+代码，彻底搞清楚原型链。"
---

原型链是 JavaScript 面向对象的基础，但很多人学完后还是一团雾水。这篇文章用图解+代码，彻底搞清楚原型链。

## 核心概念

JavaScript 里，每个对象都有一个隐式属性 `[[Prototype]]`（通过 `__proto__` 或 `Object.getPrototypeOf()` 访问），指向它的"原型"。属性查找时，如果当前对象没有这个属性，就沿着原型链向上查找。

## 函数、prototype、**proto** 的关系

```javascript
function Animal(name) {
  this.name = name;
}

Animal.prototype.speak = function () {
  console.log(`${this.name} makes a sound.`);
};

const dog = new Animal("Rex");
```

关系图：

```
Animal（函数对象）
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

用代码验证：

```javascript
dog.__proto__ === Animal.prototype; // true
Animal.prototype.constructor === Animal; // true
Animal.__proto__ === Function.prototype; // true（函数也是对象）
Function.prototype.__proto__ === Object.prototype; // true
Object.prototype.__proto__ === null; // true（链的终点）
```

## new 做了什么

```javascript
const dog = new Animal("Rex");

// 等价于手动实现 new：
function myNew(Constructor, ...args) {
  // 1. 创建新对象，原型指向 Constructor.prototype
  const obj = Object.create(Constructor.prototype);

  // 2. 执行构造函数，this 绑定到新对象
  const result = Constructor.apply(obj, args);

  // 3. 如果构造函数返回对象，返回该对象；否则返回新对象
  return result instanceof Object ? result : obj;
}

const dog2 = myNew(Animal, "Rex");
dog2.speak(); // Rex makes a sound.
```

## 继承

### ES5 原型继承

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 继承属性
  this.breed = breed;
}

// 建立原型链
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog; // 修复 constructor 指向

Dog.prototype.speak = function () {
  return `${this.name} barks`;
};

const rex = new Dog("Rex", "Labrador");
rex.speak(); // Rex barks
rex instanceof Dog; // true
rex instanceof Animal; // true
```

### ES6 class（语法糖）

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
    super(name); // 调用父类构造函数，等价于 Animal.call(this, name)
    this.breed = breed;
  }
  speak() {
    return `${this.name} barks`;
  }
}

const rex = new Dog("Rex", "Labrador");
// 底层原型链和 ES5 方式完全一样
```

## 属性查找规则

```javascript
const animal = { type: "animal" };
const dog = Object.create(animal); // dog.__proto__ === animal
dog.name = "Rex";

const labrador = Object.create(dog);
labrador.breed = "Labrador";

labrador.breed; // 'Labrador'（自身属性）
labrador.name; // 'Rex'（dog 上的属性）
labrador.type; // 'animal'（animal 上的属性）
labrador.xxx; // undefined（查到 Object.prototype 没找到）

// 检查自身属性（不查原型链）
labrador.hasOwnProperty("breed"); // true
labrador.hasOwnProperty("name"); // false（在原型上）
```

## 常见面试题

```javascript
function Foo() {}
const foo = new Foo();

// 以下哪个是 true？
foo instanceof Foo; // true
foo instanceof Object; // true
Foo instanceof Function; // true
Foo instanceof Object; // true（函数也是对象）
Function instanceof Object; // true
Object instanceof Function; // true（Object 本身是函数）
```

## 小结

- 每个对象都有 `[[Prototype]]`，属性查找沿链向上
- 函数有 `prototype` 属性，实例的 `__proto__` 指向它
- `new` 创建对象，建立原型链，执行构造函数
- ES6 `class` 是原型继承的语法糖，底层机制相同
- 链的终点是 `Object.prototype.__proto__ === null`
