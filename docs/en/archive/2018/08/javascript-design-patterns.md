---
title: "JavaScript Design Patterns: Observer, Strategy, Proxy"
date: 2018-08-14 14:48:01
tags:
  - JavaScript
  - Design Patterns
readingTime: 2
description: "Design patterns are reusable solutions to commonly occurring problems. This post covers three patterns I use frequently in frontend projects."
---

Design patterns are reusable solutions to commonly occurring problems. This post covers three patterns I use frequently in frontend projects.

## Observer Pattern

The Observer pattern defines a one-to-many dependency relationship: when one object's state changes, all dependent objects are notified automatically.

```javascript
class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  // Subscribe
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this; // supports chaining
  }

  // Unsubscribe
  off(event, callback) {
    if (!this.listeners[event]) return this;
    this.listeners[event] = this.listeners[event].filter(
      (cb) => cb !== callback,
    );
    return this;
  }

  // Trigger event
  emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
    return this;
  }

  // Subscribe once
  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// Usage
const emitter = new EventEmitter();

emitter
  .on("data", (data) => console.log("Handler 1:", data))
  .on("data", (data) => console.log("Handler 2:", data))
  .once("connect", () => console.log("Connected"));

emitter.emit("data", { id: 1 }); // Triggers both handlers
emitter.emit("connect"); // Triggers once only
```

## Strategy Pattern

The Strategy pattern defines a family of algorithms and makes them interchangeable, keeping the client code unchanged.

**Example: Discount Calculation**

```javascript
// Define strategies
const discountStrategies = {
  none: (price) => price,
  member: (price) => price * 0.9,
  vip: (price) => price * 0.8,
  flash: (price) => price * 0.5,
};

// Context
class Order {
  constructor(price, discountType) {
    this.price = price;
    this.strategy = discountStrategies[discountType] || discountStrategies.none;
  }

  calculateTotal() {
    return this.strategy(this.price);
  }
}

const order = new Order(100, "vip");
console.log(order.calculateTotal()); // 80

// Adding a new discount type requires no changes to Order
discountStrategies.blackFriday = (price) => price * 0.7;
```

**Example: Form Validation**

```javascript
const validators = {
  required: (value) => (value.trim() ? null : "This field is required"),
  email: (value) =>
    /^\S+@\S+\.\S+$/.test(value) ? null : "Please enter a valid email",
  minLength: (min) => (value) =>
    value.length >= min ? null : `Minimum ${min} characters`,
  maxLength: (max) => (value) =>
    value.length <= max ? null : `Maximum ${max} characters`,
};

function validate(value, rules) {
  for (const rule of rules) {
    const error =
      typeof rule === "function" ? rule(value) : validators[rule]?.(value);
    if (error) return error;
  }
  return null;
}

// Usage
const error = validate("hi", ["required", validators.minLength(3), "email"]);
```

## Proxy Pattern

The Proxy pattern provides a surrogate for another object to control access to it.

**Caching Proxy:**

```javascript
function createCachingProxy(fn) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      console.log("From cache");
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

function expensiveCalculation(n) {
  console.log("Computing...");
  return n * n;
}

const cachedCalc = createCachingProxy(expensiveCalculation);
cachedCalc(10); // Computing... → 100
cachedCalc(10); // From cache → 100
```

**ES6 Proxy for Type Validation:**

```javascript
function createTypeSafeObject(schema) {
  return new Proxy(
    {},
    {
      set(target, prop, value) {
        const type = schema[prop];
        if (type && typeof value !== type) {
          throw new TypeError(`${prop} must be of type ${type}`);
        }
        target[prop] = value;
        return true;
      },
    },
  );
}

const user = createTypeSafeObject({ name: "string", age: "number" });
user.name = "Alice"; // OK
user.age = 25; // OK
user.age = "twenty-five"; // TypeError: age must be of type number
```

## Summary

- **Observer**: decouples event emitters from subscribers; great for component communication and the event system
- **Strategy**: replaces complex `if/else` with pluggable algorithm families; easy to extend
- **Proxy**: intercepts property access to add caching, validation, logging, etc.

Design patterns are tools, not dogma — use them when they solve real problems.
