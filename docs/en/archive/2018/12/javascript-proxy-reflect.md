---
title: "JavaScript Proxy and Reflect: Metaprogramming"
date: 2018-12-13 16:17:56
tags:
  - JavaScript
readingTime: 2
description: "`Proxy` was added in ES2015 but has seen limited use. Vue 3's reactivity system is based on Proxy — time to understand it properly."
wordCount: 127
---

`Proxy` was added in ES2015 but has seen limited use. Vue 3's reactivity system is based on Proxy — time to understand it properly.

## Proxy Basics

Proxy can intercept many kinds of object operations:

```javascript
const handler = {
  // Intercept property reads
  get(target, prop, receiver) {
    console.log(`Reading ${prop}`);
    return Reflect.get(target, prop, receiver);
  },

  // Intercept property assignments
  set(target, prop, value, receiver) {
    console.log(`Setting ${prop} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },

  // Intercept delete
  deleteProperty(target, prop) {
    console.log(`Deleting ${prop}`);
    return Reflect.deleteProperty(target, prop);
  },

  // Intercept the in operator
  has(target, prop) {
    return prop !== "secret" && Reflect.has(target, prop);
  },
};

const obj = { name: "Alice", secret: "password" };
const proxy = new Proxy(obj, handler);

proxy.name; // Log: Reading name
proxy.age = 25; // Log: Setting age = 25
"secret" in proxy; // false (intercepted)
```

## Implementing Reactivity (Vue 3 Internals)

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, prop, receiver) {
      // Dependency tracking
      track(target, prop);
      const value = Reflect.get(target, prop, receiver);
      // If the value is an object, proxy it recursively
      return typeof value === "object" && value !== null
        ? reactive(value)
        : value;
    },

    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      // Trigger updates
      trigger(target, prop);
      return result;
    },
  });
}

const state = reactive({ count: 0, user: { name: "Alice" } });

effect(() => {
  console.log("count:", state.count); // Automatically tracks dependencies
});

state.count++; // Triggers effect to re-run
state.user.name = "Bob"; // Deep properties tracked too! (Object.defineProperty can't do this)
```

Vue 2 used `Object.defineProperty` and couldn't:

- Detect newly added properties (required `Vue.set`)
- Detect array index assignments

Vue 3 uses Proxy to solve these problems.

## Reflect: Standardizing Object Operations

`Reflect` provides static methods that correspond to Proxy handler methods:

```javascript
// Old-style
Object.defineProperty(obj, "name", { value: "Alice" });
"name" in obj;
delete obj.name;

// Reflect style (more consistent; returns boolean indicating success)
Reflect.defineProperty(obj, "name", { value: "Alice" });
Reflect.has(obj, "name");
Reflect.deleteProperty(obj, "name");

// Reflect.get ensures correct `this` (receiver parameter)
Reflect.get(target, prop, receiver); // receiver is the proxy itself
```

## Practical Application: Data Validation

```javascript
function createValidator(target, validators) {
  return new Proxy(target, {
    set(target, prop, value) {
      const validator = validators[prop];
      if (validator && !validator(value)) {
        throw new TypeError(`Invalid value "${value}" for ${prop}`);
      }
      return Reflect.set(target, prop, value);
    },
  });
}

const user = createValidator(
  {},
  {
    age: (v) => Number.isInteger(v) && v >= 0 && v <= 150,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
);

user.age = 25; // ✅
user.age = -1; // ❌ TypeError
user.email = "invalid"; // ❌ TypeError
```

## Summary

- Proxy intercepts various object operations (get/set/delete, etc.); far more powerful than `defineProperty`
- Reflect provides a unified API for object operations; typically used alongside Proxy handlers
- Vue 3 uses Proxy for reactivity, solving Vue 2's new-property detection problem
- Proxy cannot be polyfilled; it requires ES2015+ environments
