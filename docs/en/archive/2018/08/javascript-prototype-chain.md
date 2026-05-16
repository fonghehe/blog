---
title: "JavaScript Prototype Chain Illustrated"
date: 2018-08-09 15:14:28
tags:
  - JavaScript
readingTime: 2
description: "The prototype chain is a core JavaScript concept that trips up many people. This post uses diagrams and simple examples to explain it clearly."
---

The prototype chain is a core JavaScript concept that trips up many people. This post uses diagrams and simple examples to explain it clearly.

## Core Concepts

Every object has an internal property `[[Prototype]]` (accessible via `__proto__`) that points to its "prototype object". When you access a property, if the object doesn't have it, JavaScript walks up the chain — this is the prototype chain.

## Function, Prototype, and `__proto__`

```javascript
function Person(name) {
  this.name = name;
}

Person.prototype.sayHello = function () {
  return `Hello, I'm ${this.name}`;
};

const alice = new Person("Alice");

// Prototype chain:
// alice.__proto__ === Person.prototype ✓
// Person.prototype.__proto__ === Object.prototype ✓
// Object.prototype.__proto__ === null (chain ends) ✓

console.log(alice.sayHello()); // "Hello, I'm Alice"
// Property lookup:
// alice.sayHello → not found on alice
//               → look at alice.__proto__ (Person.prototype)
//               → found! return it
```

ASCII diagram of the relationships:

```
alice ─── __proto__ ──→ Person.prototype ─── __proto__ ──→ Object.prototype ─── __proto__ ──→ null
               ↑                    ↑
           constructor          constructor
               |                    |
             Person            (built-in)
               |
           prototype ──→ Person.prototype
```

## What `new` Does

```javascript
// new Person('Alice') actually does:
function myNew(Constructor, ...args) {
  // 1. Create a new empty object
  const obj = {};

  // 2. Set prototype: obj.__proto__ = Constructor.prototype
  Object.setPrototypeOf(obj, Constructor.prototype);

  // 3. Call the constructor, passing the new object as `this`
  const result = Constructor.apply(obj, args);

  // 4. If the constructor returns an object, use that; otherwise return obj
  return result instanceof Object ? result : obj;
}

const alice = myNew(Person, "Alice");
```

## ES5 Inheritance (Object.create)

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};

function Dog(name, breed) {
  Animal.call(this, name); // call parent constructor
  this.breed = breed;
}

// The key line: set Dog's prototype to Animal.prototype
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog; // fix the constructor reference

Dog.prototype.bark = function () {
  return `${this.name} barks`;
};

const rex = new Dog("Rex", "Husky");
rex.speak(); // "Rex makes a sound" — from Animal
rex.bark(); // "Rex barks" — from Dog
```

## ES6 Class: Syntactic Sugar

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
    super(name); // equivalent to Animal.call(this, name)
    this.breed = breed;
  }

  bark() {
    return `${this.name} barks`;
  }
}

// The underlying prototype chain is identical to the ES5 version above
```

## Property Lookup Rules

```javascript
const obj = { a: 1 };
const child = Object.create(obj);
child.b = 2;

// Lookup child.a:
// 1. Look for 'a' on child → not found
// 2. Look for 'a' on child.__proto__ (= obj) → found! return 1

// hasOwnProperty: checks only the object itself, not the prototype chain
child.hasOwnProperty("a"); // false
child.hasOwnProperty("b"); // true

// for...in traverses the entire prototype chain
for (const key in child) {
  console.log(key); // outputs: b, a
}

// Only own properties
for (const key in child) {
  if (child.hasOwnProperty(key)) {
    console.log(key); // outputs: b
  }
}
```

## Classic Interview Questions

```javascript
// Question 1: What is typeof null?
typeof null; // "object" — historical JavaScript bug

// Question 2: What does instanceof check?
[] instanceof Array; // true — checks if Array.prototype is in []'s prototype chain
[] instanceof Object; // true — Array.prototype.__proto__ === Object.prototype

// Question 3: Prototype chain after Object.create(null)
const obj = Object.create(null);
obj.__proto__; // undefined — no prototype chain at all
// Used for truly clean dictionary objects, avoiding toString, hasOwnProperty etc.
```

## Summary

- Each object has `__proto__` pointing to its prototype; property lookup walks up the chain
- Functions have a `prototype` property; after `new`, the instance's `__proto__` is set to it
- `class` is syntactic sugar, the underlying mechanism is still the prototype chain
- `hasOwnProperty` checks own properties only; `in` operator traverses the full chain
