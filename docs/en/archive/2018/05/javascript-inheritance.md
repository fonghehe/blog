---
title: "JavaScript Inheritance Patterns"
date: 2018-05-24 16:15:02
tags:
  - JavaScript
readingTime: 1
description: "A classic interview topic, but understanding it thoroughly also has real practical value. JS has many inheritance patterns, each suited to different situations."
wordCount: 134
---

A classic interview topic, but understanding it thoroughly also has real practical value. JS has many inheritance patterns, each suited to different situations.

## Prototype Chain Inheritance

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

function Dog(name) {
  this.name = name;
}
Dog.prototype = new Animal(); // prototype chain inheritance

const dog = new Dog("Rex");
dog.speak(); // 'Rex makes a sound'
```

**Problem**: all subclass instances share reference-type properties on the prototype.

```javascript
function Animal() {
  this.friends = []; // reference type
}
Dog.prototype = new Animal();

const d1 = new Dog();
const d2 = new Dog();
d1.friends.push("cat");
console.log(d2.friends); // ['cat'] ← d2 is also affected!
```

## Constructor Inheritance (Borrowing Constructors)

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}

function Dog(name, breed) {
  Animal.call(this, name); // call the parent constructor inside the child
  this.breed = breed;
}

const d1 = new Dog("Rex", "Shiba");
const d2 = new Dog("Noir", "Labrador");
d1.friends.push("cat");
console.log(d2.friends); // [] ← no cross-contamination
```

**Problem**: cannot inherit methods from the parent prototype (`Animal.prototype.speak` is not available).

## Combination Inheritance (Most Common Classic Pattern)

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

function Dog(name, breed) {
  Animal.call(this, name); // 1. inherit properties
  this.breed = breed;
}
Dog.prototype = new Animal(); // 2. inherit methods
Dog.prototype.constructor = Dog; // 3. fix constructor

const dog = new Dog("Rex", "Shiba");
dog.speak(); // ✅ can call parent method
dog.friends; // ✅ independent, not shared
```

**Problem**: `Animal` is called twice (performance waste).

## Object.create: Parasitic Combination Inheritance (Best Classic Pattern)

```javascript
function Animal(name) {
  this.name = name;
  this.friends = [];
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

function Dog(name, breed) {
  Animal.call(this, name);
  this.breed = breed;
}

// Key: use Object.create instead of new Animal() — avoids calling parent constructor twice
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;

// Subclass methods
Dog.prototype.bark = function () {
  return "Woof!";
};
```

## ES6 class (Modern Approach)

```javascript
class Animal {
  constructor(name) {
    this.name = name;
    this.friends = [];
  }

  speak() {
    return `${this.name} makes a sound`;
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name); // must call super first
    this.breed = breed;
  }

  bark() {
    return "Woof!";
  }
}

const dog = new Dog("Rex", "Shiba");
dog.speak(); // 'Rex makes a sound'
dog.bark(); // 'Woof!'
dog instanceof Animal; // true
dog instanceof Dog; // true
```

## Summary

| Pattern               | Inherits Properties | Inherits Methods | Recommended               |
| --------------------- | ------------------- | ---------------- | ------------------------- |
| Prototype chain       | ❌ shared           | ✅               | ❌                        |
| Constructor           | ✅                  | ❌               | ❌                        |
| Combination           | ✅                  | ✅               | Usable but has perf issue |
| Parasitic combination | ✅                  | ✅               | ✅ Best pre-ES6           |
| ES6 class             | ✅                  | ✅               | ✅ Modern first choice    |

Use ES6 `class` for new code. Understanding prototype chain inheritance is for reading legacy code and acing interviews.
