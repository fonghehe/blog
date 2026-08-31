---
title: "Frontend Performance Optimization Techniques: A Summary"
date: 2019-03-11 10:41:26
tags:
  - Frontend
readingTime: 1
description: "Promoting frontend performance optimization techniques within the team came with plenty of pitfalls. Documenting them here in the hope it helps others."
wordCount: 85
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

In real projects, you'll also need to handle edge cases and errors.

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

Rolling this pattern out across the team worked well and noticeably cut maintenance costs.

## Business Scenarios

Here's one way to implement it:

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

Keep an eye on the performance characteristics in the code above, and avoid needless computation.
