---
title: "Node.js Error Handling Best Practices"
date: 2019-04-15 11:14:06
tags:
  - Node.js
readingTime: 1
description: "There are plenty of articles on Node.js error handling best practices online, but most lack real-world experience. This article explores best practices based on"
wordCount: 116
---

There are plenty of articles on Node.js error handling best practices online, but most lack real-world experience. This article explores best practices based on actual projects.

## Quick Start

Here is a practical example:

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

After rolling this pattern out across the team, the results were great — maintenance costs dropped noticeably.

## Advanced Usage

This can be implemented as follows:

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

Pay attention to the performance details in the code above and avoid unnecessary computations.

## Handling Typed Errors

Always type your errors to distinguish between operational errors and programmer errors:

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

Always handle errors at the appropriate layer — operational errors should be caught and handled gracefully, while programming errors should let the process crash so they can be fixed.
