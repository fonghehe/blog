---
title: "Beyond Debounce and Throttle: Functional Programming in Frontend"
date: 2018-07-03 10:12:42
tags:
  - Frontend
readingTime: 2
description: "I've been reading about functional programming lately and realized many of these ideas have already been in use in frontend development — we just never explicit"
---

I've been reading about functional programming lately and realized many of these ideas have already been in use in frontend development — we just never explicitly recognized them. Here are the parts that have real practical value.

## Pure Functions: Predictable Functions

Pure functions have two characteristics:

1. Same input always returns the same output
2. No side effects (doesn't modify external state)

```javascript
// ❌ Not a pure function: result depends on external variable
let discount = 0.9;
function getPrice(price) {
  return price * discount; // result changes if discount changes
}

// ✅ Pure function
function getPrice(price, discount) {
  return price * discount; // same input always produces same output
}
```

Benefits of pure functions:

- Easy to test (no need to mock external state)
- Easy to cache (same input = same output, can be memoized)
- Easy to reason about (no side effects to worry about)

## Function Composition

Combine small functions into complex data processing pipelines:

```javascript
// Original: nested calls
const result = sanitize(trim(toLowerCase(input)));

// Function composition
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

const processInput = pipe(toLowerCase, trim, sanitize);

const result = processInput(input); // executes left to right
```

Real-world use case:

```javascript
// Data processing pipeline
const processUsers = pipe(
  (users) => users.filter((u) => u.isActive),
  (users) => users.map((u) => ({ ...u, name: u.name.trim() })),
  (users) => users.sort((a, b) => a.name.localeCompare(b.name)),
);

const activeUsers = processUsers(rawUsers);
```

## Currying

Convert a multi-argument function into a sequence of single-argument functions:

```javascript
// Regular function
function add(a, b) {
  return a + b;
}

// Curried
function curriedAdd(a) {
  return function (b) {
    return a + b;
  };
}

// Arrow function shorthand
const curriedAdd = (a) => (b) => a + b;

const add5 = curriedAdd(5); // fix first argument
add5(3); // 8
add5(10); // 15
```

Practical use:

```javascript
// Parameterized validation functions
const minLength = (min) => (str) => str.length >= min;
const maxLength = (max) => (str) => str.length <= max;
const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const validators = {
  username: [minLength(3), maxLength(20)],
  email: [isEmail],
  password: [minLength(8)],
};

function validate(value, rules) {
  return rules.every((rule) => rule(value));
}

validate("alice", validators.username); // true
validate("ab", validators.username); // false (too short)
```

## Immutable Data

Avoid modifying data directly — create new data instead:

```javascript
// ❌ Direct mutation
function updateUser(user, newName) {
  user.name = newName; // mutates the original object
  return user;
}

// ✅ Create a new object
function updateUser(user, newName) {
  return { ...user, name: newName };
}

// Array operations
// ❌ Direct mutation
list.push(newItem);
list.splice(index, 1);

// ✅ Immutable operations
const newList = [...list, newItem];
const filteredList = list.filter((_, i) => i !== index);
```

Benefits of immutable data:

- Easier to track changes (both old and new exist for comparison)
- More reliable change detection in Vue/React
- Time-travel debugging (Redux DevTools) becomes possible

## Applying in Vue

```javascript
// Computed properties (pure functions)
computed: {
  filteredList() {
    // doesn't modify this.list, returns a new array
    return this.list
      .filter(item => item.status === this.filterStatus)
      .map(item => ({ ...item, label: item.name.toUpperCase() }))
  }
}
```

```javascript
// Vuex mutations — maintain immutability
mutations: {
  UPDATE_USER(state, payload) {
    // ✅ use spread operator to create a new object
    state.users = state.users.map(user =>
      user.id === payload.id
        ? { ...user, ...payload.changes }
        : user
    )
  }
}
```

## Summary

Functional ideas don't need to be adopted wholesale. The useful parts are:

- **Pure functions**: write utility functions as pure functions for easy testing
- **Immutable data**: follow immutability in state management
- **Function composition**: use `pipe` for complex data processing, clearer than nested calls
- No need to pursue "functional purity" — mixing with imperative code is perfectly fine
