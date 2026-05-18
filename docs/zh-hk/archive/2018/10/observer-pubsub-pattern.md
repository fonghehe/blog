---
title: "JavaScript 設計模式：觀察者與發佈訂閲"
date: 2018-10-09 10:17:43
tags:
  - 前端
readingTime: 1
description: "這兩個模式經常被混為一談，但有本質區別。"
---

這兩個模式經常被混為一談，但有本質區別。

## 觀察者模式（Observer Pattern）

被觀察者（Subject）和觀察者（Observer）直接通信，強耦合：

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

// 使用
const emitter = new EventEmitter();
emitter.on("data", (data) => console.log("收到:", data));
emitter.emit("data", { id: 1 });
```

Node.js 的 `EventEmitter` 就是這個模式的實現。

## 發佈訂閲模式（Pub/Sub）

引入中間層（事件總線/消息中心），發佈者和訂閲者完全不認識對方：

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

// 全局事件總線
const bus = new EventBus();

// 組件 A：發佈者
bus.publish("user:login", { userId: 123, name: "Alice" });

// 組件 B：訂閲者（不知道 A 的存在）
bus.subscribe("user:login", (user) => {
  updateNavBar(user.name);
});

// 組件 C：另一個訂閲者
bus.subscribe("user:login", (user) => {
  initUserPreferences(user.userId);
});
```

## Vue 中的事件總線

```javascript
// main.js
Vue.prototype.$bus = new Vue()

// 組件 A
this.$bus.$emit('global-event', payload)

// 組件 B
this.$bus.$on('global-event', (payload) => { ... })
// 別忘了在 beforeDestroy 取消訂閲！
this.$bus.$off('global-event', handler)
```

## 兩者對比

|      | 觀察者                   | 發佈訂閲            |
| 
---- | ------------------------ | ------------------- |
| 耦合 | 強（直接引用）           | 松（通過中間層）    |
| 適合 | 同一模塊內通信           | 跨模塊/組件通信     |
| 示例 | DOM 事件、Vue 組件 $emit | Vue 事件總線、Redux |

## 小結

- 觀察者：被觀察者直接通知觀察者，適合緊密關聯的對象
- 發佈訂閲：通過事件總線解耦，發佈者和訂閲者互不知情
- Vue 的 `$emit` 是觀察者（父知道子），事件總線是發佈訂閲
