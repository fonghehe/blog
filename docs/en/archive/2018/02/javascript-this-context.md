---
title: "JavaScript this Binding Explained"
date: 2018-02-15 14:48:07
tags:
  - JavaScript
readingTime: 1
description: "`this` is one of the most error-prone concepts in JS. After more than a year of coding, I finally got the rules straight."
wordCount: 98
---

`this` is one of the most error-prone concepts in JS. After more than a year of coding, I finally got the rules straight.

## Four Binding Rules

### 1. Default Binding

```javascript
function sayName() {
  console.log(this.name);
}

var name = "global";
sayName(); // 'global' (non-strict mode, this points to window)

// Strict mode
("use strict");
sayName(); // TypeError: Cannot read property 'name' of undefined
```

### 2. Implicit Binding

```javascript
const user = {
  name: "Alice",
  greet() {
    console.log(`Hello, ${this.name}`);
  },
};

user.greet(); // 'Hello, Alice' (this points to user)

// Implicit binding loss: assigning a method to a variable
const greet = user.greet;
greet(); // 'Hello, undefined' (this becomes window)
```

This "loss" is the most common source of bugs:

```javascript
// this lost in async callback
const timer = {
  count: 0,
  start() {
    setInterval(function () {
      this.count++; // this is NOT timer!
    }, 1000);
  },
};
```

### 3. Explicit Binding

```javascript
function greet(greeting) {
  console.log(`${greeting}, ${this.name}`);
}

const user = { name: "Alice" };

greet.call(user, "Hello"); // call: invoke immediately, args passed individually
greet.apply(user, ["Hello"]); // apply: invoke immediately, args as array
const boundGreet = greet.bind(user); // bind: returns new function, not invoked immediately
boundGreet("Hello");
```

### 4. new Binding

```javascript
function Person(name) {
  this.name = name; // this points to the newly created object
}

const p = new Person("Alice");
console.log(p.name); // 'Alice'
```

## Arrow Functions: No Own this

```javascript
const timer = {
  count: 0,
  start() {
    // Arrow function inherits this from the outer scope (start method)
    setInterval(() => {
      this.count++; // this IS timer ✅
    }, 1000);
  },
};

// Vue pitfall: don't use arrow functions in methods
export default {
  data() {
    return { name: "Alice" };
  },
  methods: {
    // Wrong: arrow function, this is not the Vue instance
    greet: () => {
      console.log(this.name); // undefined
    },
    // Correct
    greet() {
      console.log(this.name); // 'Alice'
    },
  },
};
```

## Priority

```
new > explicit binding (call/apply/bind) > implicit binding > default binding
```

## Practical Scenario Summary

```javascript
// Scenario 1: event callbacks, use arrow functions to preserve this
class Component {
  handleClick = () => {
    // class property syntax, arrow function
    console.log(this); // always the Component instance
  };
}

// Scenario 2: situations that need dynamic this, don't use arrow functions
const obj = {
  value: 42,
  getValue() {
    return this.value;
  }, // regular function, this follows call site
};
```

## Summary

- Regular functions: `this` is determined at **call time**, not at definition time
- Arrow functions: `this` is **inherited from the outer scope** at definition time, never changes
- Priority: new > call/apply/bind > object method call > default window
- Don't use arrow functions for Vue methods
