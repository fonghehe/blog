---
title: "Implementing the Promise/A+ Specification by Hand"
date: 2019-01-08 11:17:13
tags:
  - JavaScript
readingTime: 1
description: "A classic interview question, but implementing it yourself gives you the deepest understanding."
---

A classic interview question, but implementing it yourself gives you the deepest understanding.

## Core of the Promise/A+ Spec

1. A Promise has three states: pending → fulfilled or pending → rejected (irreversible)
2. `then` returns a new Promise (enabling chaining)
3. Async handling, value pass-through, and error capture

```javascript
class MyPromise {
  constructor(executor) {
    this.state = "pending";
    this.value = undefined;
    this.reason = undefined;
    this.fulfilledCallbacks = [];
    this.rejectedCallbacks = [];

    const resolve = (value) => {
      if (this.state !== "pending") return;
      this.state = "fulfilled";
      this.value = value;
      this.fulfilledCallbacks.forEach((fn) => fn(value));
    };

    const reject = (reason) => {
      if (this.state !== "pending") return;
      this.state = "rejected";
      this.reason = reason;
      this.rejectedCallbacks.forEach((fn) => fn(reason));
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    // Value pass-through
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (e) => {
            throw e;
          };

    return new MyPromise((resolve, reject) => {
      const handleFulfilled = (value) => {
        try {
          const result = onFulfilled(value);
          resolvePromise(result, resolve, reject);
        } catch (e) {
          reject(e);
        }
      };

      const handleRejected = (reason) => {
        try {
          const result = onRejected(reason);
          resolvePromise(result, resolve, reject);
        } catch (e) {
          reject(e);
        }
      };

      if (this.state === "fulfilled") {
        queueMicrotask(() => handleFulfilled(this.value));
      } else if (this.state === "rejected") {
        queueMicrotask(() => handleRejected(this.reason));
      } else {
        this.fulfilledCallbacks.push((v) =>
          queueMicrotask(() => handleFulfilled(v)),
        );
        this.rejectedCallbacks.push((r) =>
          queueMicrotask(() => handleRejected(r)),
        );
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(callback) {
    return this.then(
      (value) => MyPromise.resolve(callback()).then(() => value),
      (reason) =>
        MyPromise.resolve(callback()).then(() => {
          throw reason;
        }),
    );
  }

  static resolve(value) {
    if (value instanceof MyPromise) return value;
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  static all(promises) {
    return new MyPromise((resolve, reject) => {
      const results = [];
      let count = 0;
      promises.forEach((promise, i) => {
        MyPromise.resolve(promise).then((value) => {
          results[i] = value;
          if (++count === promises.length) resolve(results);
```
