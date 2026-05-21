---
title: "Common JavaScript Design Patterns in Practice"
date: 2019-06-20 17:03:37
tags:
  - JavaScript
readingTime: 1
description: "Design patterns are not exclusive to backend development — they are used extensively in frontend code too. Mastering these patterns makes code more elegant and "
wordCount: 81
---

Design patterns are not exclusive to backend development — they are used extensively in frontend code too. Mastering these patterns makes code more elegant and maintainable.

## Singleton Pattern

Ensures a class has only one instance, globally sharing the same object. The most common frontend scenarios: global state management, modal management, authentication state.

```javascript
// Implementation 1: closure
const Singleton = (function () {
  let instance;

  function createInstance(options) {
    return {
      name: options.name,
      log() {
        console.log(`Instance name: ${this.name}`);
      },
    };
  }

  return {
    getInstance(options) {
      if (!instance) {
        instance = createInstance(options);
      }
      return instance;
    },
  };
})();

const s1 = Singleton.getInstance({ name: "app" });
const s2 = Singleton.getInstance({ name: "other" });
console.log(s1 === s2); // true — always the same instance
```

```javascript
// Implementation 2: ES6 class + static method
class ModalManager {
  static instance = null;

  constructor() {
    this.modals = [];
  }

  static getInstance() {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  open(config) {
    const modal = { id: Date.now(), ...config, visible: true };
    this.modals.push(modal);
    return modal.id;
  }

  close(id) {
    const index = this.modals.findIndex((m) => m.id === id);
    if (index > -1) this.modals.splice(index, 1);
  }
}
```

## Observer Pattern

```javascript
class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(event, handler) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(handler);
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.events.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.events.get(event)?.forEach((handler) => handler(data));
  }
}

const bus = new EventBus();
const unsubscribe = bus.on("user:login", (user) =>
  console.log("User logged in:", user),
);
bus.emit("user:login", { name: "Alice" });
unsubscribe(); // clean up
```

## Strategy Pattern

```javascript
// Without Strategy: large switch/if-else
function calculateDiscount(type, price) {
  if (type === "vip") return price * 0.8;
  if (type === "member") return price * 0.9;
  if (type === "newuser") return price - 20;
  return price;
}

// With Strategy: extensible, open for extension closed for modification
const discountStrategies = {
  vip: (price) => price * 0.8,
  member: (price) => price * 0.9,
  newuser: (price) => Math.max(0, price - 20),
  default: (price) => price,
};

function calculateDiscount(type, price) {
  const strategy = discountStrategies[type] || discountStrategies.default;
  return strategy(price);
}

// Adding a new discount type requires zero changes to existing code
discountStrategies.superVip = (price) => price * 0.7;
```

These three patterns — Singleton, Observer, and Strategy — cover the majority of real-world frontend scenarios. Master them and you'll write cleaner, more maintainable code.
