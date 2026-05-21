---
title: "Webpack 4 Tree Shaking In Depth"
date: 2019-03-21 09:49:12
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "Promoting Webpack 4 Tree Shaking within the team came with plenty of pitfalls. Documenting them here in the hope it helps others."
wordCount: 117
---

Promoting Webpack 4 Tree Shaking within the team came with plenty of pitfalls. Documenting them here in the hope it helps others.

## Basic Usage

Here is the core code:

```javascript
import React, { Component } from "react";

class Form extends Component {
  state = { name: "", email: "", errors: {} };

  handleChange = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  };

  handleSubmit = (e) => {
    e.preventDefault();
    const errors = this.validate();
    if (Object.keys(errors).length === 0) {
      this.props.onSubmit(this.state);
    } else {
      this.setState({ errors });
    }
  };

  validate() {
    const errors = {};
    if (!this.state.name) errors.name = "必填";
    if (!this.state.email.includes("@")) errors.email = "格式错误";
    return errors;
  }

  render() {
    return <form onSubmit={this.handleSubmit}>...</form>;
  }
}
```

In real projects, you also need to consider edge cases and error handling.

## Advanced Techniques

Here is a real-world example:

```javascript
function deepClone(obj, map = new WeakMap()) {
  if (obj === null || typeof obj !== "object") return obj;
  if (map.has(obj)) return map.get(obj);

  const clone = Array.isArray(obj) ? [] : {};
  map.set(obj, clone);

  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key], map);
  }
  return clone;
}
```

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Practical Case

This can be achieved with the following approach:

```javascript
function pLimit(concurrency) {
  const queue = [];
  let active = 0;

  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}
```

Pay attention to the performance details in the code above and avoid unnecessary computation.

## Summary

- Choose the right approach for each scenario in real projects
- Team-wide conventions are more important than chasing perfect implementations
- Keep learning and summarizing to maintain technical awareness
