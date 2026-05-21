---
title: "JavaScript Iterators and Generators"
date: 2018-10-11 14:38:00
tags:
  - JavaScript
readingTime: 2
description: "ES6's iterators and generators are tools for implementing custom iteration. Generators are used internally in both Vuex and Redux-Saga."
wordCount: 162
---

ES6's iterators and generators are tools for implementing custom iteration. Generators are used internally in both Vuex and Redux-Saga.

## The Iterator Protocol

An iterator is an object with a `next()` method that returns `{ value, done }` on each call:

```javascript
// Manually crafting an iterator
function createRangeIterator(start, end) {
  let current = start;
  return {
    next() {
      if (current <= end) {
        return { value: current++, done: false };
      }
      return { value: undefined, done: true };
    },
  };
}

const iter = createRangeIterator(1, 3);
iter.next(); // { value: 1, done: false }
iter.next(); // { value: 2, done: false }
iter.next(); // { value: 3, done: false }
iter.next(); // { value: undefined, done: true }
```

## The Iterable Protocol

An object that implements the `Symbol.iterator` method is iterable and can be used with `for...of`, spread, and destructuring:

```javascript
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}

const range = new Range(1, 5);
for (const n of range) {
  console.log(n);
} // 1 2 3 4 5
console.log([...range]); // [1, 2, 3, 4, 5]
const [first, second] = range; // destructuring
```

## Generators

A generator is declared with `function*` and uses `yield` to pause execution:

```javascript
function* range(start, end) {
  for (let i = start; i <= end; i++) {
    yield i; // pause, return i, wait for the next next()
  }
}

const gen = range(1, 3);
gen.next(); // { value: 1, done: false }
gen.next(); // { value: 2, done: false }
gen.next(); // { value: 3, done: false }
gen.next(); // { value: undefined, done: true }

// A generator returns an iterable
for (const n of range(1, 5)) {
  console.log(n);
}
```

## Two-way Communication with yield

`yield` doesn't just return values — it can also receive them:

```javascript
function* logger() {
  while (true) {
    const input = yield; // pause and wait for an external value
    console.log("[LOG]", input);
  }
}

const log = logger();
log.next(); // Start the generator (runs to the first yield)
log.next("First log entry"); // Pass a value in, execution resumes
log.next("Second log entry");
```

## Real-world Use: The Foundation of async/await

`async/await` is essentially syntactic sugar over generators + Promises:

```javascript
// Generator version
function* fetchUser(id) {
  const user = yield fetch(`/api/users/${id}`).then((r) => r.json());
  const orders = yield fetch(`/api/orders?userId=${user.id}`).then((r) =>
    r.json(),
  );
  return { user, orders };
}

// Needs an "executor" to drive the generator
// (that's what the `co` library does)

// async/await version (equivalent but more concise)
async function fetchUser(id) {
  const user = await fetch(`/api/users/${id}`).then((r) => r.json());
  const orders = await fetch(`/api/orders?userId=${user.id}`).then((r) =>
    r.json(),
  );
  return { user, orders };
}
```

## Generators in Redux-Saga

```javascript
// redux-saga uses generators to describe async flows
function* fetchUserSaga(action) {
  try {
    const user = yield call(fetchUser, action.id); // call: invoke async function
    yield put({ type: "FETCH_USER_SUCCESS", user }); // put: dispatch action
  } catch (e) {
    yield put({ type: "FETCH_USER_FAILURE", error: e.message });
  }
}
```

This makes async flows very easy to test (you only need to check the effect objects, without actually running async operations).

## Summary

- Iterator protocol: `next()` returns `{ value, done }`
- Iterable protocol: implement `[Symbol.iterator]` to support `for...of`, destructuring, and spread
- Generators: `function*` + `yield` simplify writing iterators
- `async/await` is syntactic sugar for generators + Promises
