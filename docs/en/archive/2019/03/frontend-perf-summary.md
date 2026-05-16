---
title: "Frontend Performance Optimization Techniques: A Summary"
date: 2019-03-11 10:41:26
tags:
  - Frontend
readingTime: 1
description: "Promoting frontend performance optimization techniques within the team came with plenty of pitfalls. Documenting them here in the hope it helps others."
---

Promoting frontend performance optimization techniques within the team came with plenty of pitfalls. Documenting them here in the hope it helps others.

## Getting Started

Here is the core code:

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

In real projects, you also need to consider edge cases and error handling.

## Advanced Usage

Here is a real-world example:

```javascript
class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.events.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    }
  }

  emit(event, ...args) {
    const handlers = this.events.get(event) || [];
    handlers.forEach((h) => h(...args));
  }
}
```

After promoting this pattern across the team, the results were great and maintenance costs dropped noticeably.

## Business Scenarios

This can be achieved with the following approach:

```javascript
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
}

function createUser(data: Partial<User>): User {
  return {
    id: Date.now(),
    name: data.name || '',
    email: data.email || '',
    role: data.role || 'user'
  }
}

type UserKeys = keyof User  // 'id' | 'name' | 'email' | 'role'
```

Pay attention to the performance details in the code above and avoid unnecessary computation.
