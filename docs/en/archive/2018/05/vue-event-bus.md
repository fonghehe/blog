---
title: "Vue Event Bus: Component Communication"
date: 2018-05-19 10:45:27
tags:
  - Vue
readingTime: 1
description: "Vue has two main component communication solutions — parent-child (props/emit) and Vuex (global state) — plus a lightweight option: the Event Bus. It's suitable"
---

Vue has two main component communication solutions — parent-child (props/emit) and Vuex (global state) — plus a lightweight option: the Event Bus. It's suitable for simple communication between sibling or cross-level components.

## Creating an Event Bus

```javascript
// src/utils/eventBus.js
import Vue from "vue";
export const EventBus = new Vue();
```

Or attach it to the Vue prototype:

```javascript
// main.js
import Vue from "vue";
Vue.prototype.$bus = new Vue();
```

## Basic Usage

```javascript
// Component A: emit an event
import { EventBus } from '@/utils/eventBus'

export default {
  methods: {
    handleLogin(user) {
      EventBus.$emit('user:login', user)
    }
  }
}

// Component B: listen for the event
import { EventBus } from '@/utils/eventBus'

export default {
  created() {
    EventBus.$on('user:login', this.handleUserLogin)
  },
  beforeDestroy() {
    // ⚠️ Must remove the listener before destroying! Otherwise memory leaks.
    EventBus.$off('user:login', this.handleUserLogin)
  },
  methods: {
    handleUserLogin(user) {
      console.log('User logged in:', user.name)
    }
  }
}
```

## Using Vue.prototype.$bus

```javascript
// Component A
this.$bus.$emit("refresh-list");

// Component B
export default {
  created() {
    this.$bus.$on("refresh-list", this.loadList);
  },
  beforeDestroy() {
    this.$bus.$off("refresh-list", this.loadList);
  },
};
```

## Important Notes

**Always call `$off` in `beforeDestroy`:**

```javascript
// ❌ $on without $off: listener remains after component is destroyed
// Revisiting the component registers a second listener — fires twice
// After several round trips it fires many times; also a memory leak

// ✅ Pair them together
created() {
  this.$bus.$on('event', this.handler)
},
beforeDestroy() {
  this.$bus.$off('event', this.handler)
  // Note: must pass the function reference — anonymous functions don't work
  // This won't work:
  // this.$bus.$off('event', () => this.handler()) ← not the same function
}
```

## Event Bus vs Vuex

```
Event Bus is better for:
  - Simple communication between two or three components
  - One-time notifications that don't need to persist
  - Quick prototyping

Vuex is better for:
  - State shared by multiple components
  - Time-travel debugging
  - State that needs to persist
  - Team projects requiring clear data flow
```

If the number of events going through the Event Bus keeps growing, it's time to migrate to Vuex.

## Summary

- An Event Bus is essentially an empty Vue instance used for publish/subscribe
- `$emit` sends, `$on` listens, `$off` unregisters
- Always call `$off` when the component is destroyed, otherwise memory leaks
- Suitable for simple inter-component communication; use Vuex for complex cases
