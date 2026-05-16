---
title: "JavaScript Object-Oriented Programming: Prototype Chains and Class Design"
date: 2018-03-30 11:27:27
tags:
  - JavaScript
readingTime: 1
description: "ES6's `class` syntax makes JavaScript OOP more intuitive to write, but underneath it's still prototype chains. Understanding both layers of abstraction gives yo"
---

ES6's `class` syntax makes JavaScript OOP more intuitive to write, but underneath it's still prototype chains. Understanding both layers of abstraction gives you more confidence when choosing inheritance approaches and debugging problems.

## Prototype Chain Basics

Every JavaScript object has an implicit prototype `[[Prototype]]`, and property lookups traverse the chain upward:

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

## ES6 class Syntax

`class` is syntactic sugar for prototype inheritance, closer to other languages:

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

## Static Methods and Private Fields (Stage 3)

```javascript
class Counter {
  #count = 0; // private field (Stage 3 proposal as of 2018)

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

## Composition vs Inheritance

Inheritance expresses "is-a" relationships; composition expresses "has-a". Over-using inheritance leads to tight coupling:

```javascript
// ❌ Over-inheritance
class FlyingFishAnimal extends Animal { ... }

// ✅ Composition
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

## Common Pitfalls

**1. Losing this**

```javascript
class Timer {
  constructor() {
    this.seconds = 0;
  }
  start() {
    // ❌ this inside setTimeout is not the Timer instance
    // setTimeout(function() { this.seconds++; }, 1000);
    // ✅ use arrow function
    setTimeout(() => {
      this.seconds++;
    }, 1000);
  }
}
```

**2. Forgetting super()**

```javascript
class Child extends Parent {
  constructor(name) {
    // super() must be called before using this
    super(name); // ✅
    this.extra = "extra";
  }
}
```

## Summary

ES6 class syntax greatly improves the readability of JavaScript OOP. Understanding prototype chains is fundamental to writing good JS, and using composition patterns thoughtfully avoids the maintenance problems caused by deep inheritance hierarchies.
