---
title: "JavaScript Design Patterns: Observer vs Pub/Sub"
date: 2018-10-09 10:17:43
tags:
  - Frontend
readingTime: 1
description: "These two patterns are often confused, but there is a fundamental difference between them."
wordCount: 129
---

These two patterns are often confused, but there is a fundamental difference between them.

## Observer Pattern

The Subject (Observable) and Observer communicate directly — they are tightly coupled:

```javascript
class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    }
    return this;
  }

  emit(event, ...args) {
    this.listeners[event]?.forEach((cb) => cb(...args));
    return this;
  }

  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
    return this;
  }
}

// Usage
const emitter = new EventEmitter();
emitter.on("data", (data) => console.log("Received:", data));
emitter.emit("data", { id: 1 });
```

Node.js's `EventEmitter` is an implementation of this pattern.

## Publish/Subscribe Pattern

An intermediary (event bus / message broker) is introduced so publishers and subscribers are completely unaware of each other:

```javascript
class EventBus {
  constructor() {
    this.topics = {};
  }

  subscribe(topic, subscriber) {
    if (!this.topics[topic]) {
      this.topics[topic] = [];
    }
    this.topics[topic].push(subscriber);
  }

  publish(topic, data) {
    this.topics[topic]?.forEach((subscriber) => subscriber(data));
  }

  unsubscribe(topic, subscriber) {
    this.topics[topic] =
      this.topics[topic]?.filter((s) => s !== subscriber) || [];
  }
}

// Global event bus
const bus = new EventBus();

// Component A: publisher
bus.publish("user:login", { userId: 123, name: "Alice" });

// Component B: subscriber (unaware of Component A's existence)
bus.subscribe("user:login", (user) => {
  updateNavBar(user.name);
});

// Component C: another subscriber
bus.subscribe("user:login", (user) => {
  initUserPreferences(user.userId);
});
```

## Event Bus in Vue

```javascript
// main.js
Vue.prototype.$bus = new Vue()

// Component A
this.$bus.$emit('global-event', payload)

// Component B
this.$bus.$on('global-event', (payload) => { ... })
// Don't forget to unsubscribe in beforeDestroy!
this.$bus.$off('global-event', handler)
```

## Comparison

|          | Observer                      | Pub/Sub                          |
| -------- | ----------------------------- | -------------------------------- |
| Coupling | Tight (direct reference)      | Loose (via intermediary)         |
| Best for | Communication within a module | Cross-module/component messaging |
| Examples | DOM events, Vue `$emit`       | Vue event bus, Redux             |

## Summary

- Observer: the subject notifies observers directly — suitable for tightly related objects
- Pub/Sub: decoupled via an event bus — publisher and subscriber are unaware of each other
- Vue's `$emit` is Observer (parent knows about child); the event bus is Pub/Sub
