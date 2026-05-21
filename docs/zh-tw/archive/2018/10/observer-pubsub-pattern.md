---
title: "JavaScript 設計模式：觀察者與釋出訂閱"
date: 2018-10-09 10:17:43
tags:
  - 前端
readingTime: 1
description: "這兩個模式經常被混為一談，但有本質區別。"
wordCount: 231
---

這兩個模式經常被混為一談，但有本質區別。

## 觀察者模式（Observer Pattern）

被觀察者（Subject）和觀察者（Observer）直接通訊，強耦合：

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

## 釋出訂閱模式（Pub/Sub）

引入中間層（事件匯流排/訊息中心），釋出者和訂閱者完全不認識對方：

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

// 全域性事件匯流排
const bus = new EventBus();

// 元件 A：釋出者
bus.publish("user:login", { userId: 123, name: "Alice" });

// 元件 B：訂閱者（不知道 A 的存在）
bus.subscribe("user:login", (user) => {
  updateNavBar(user.name);
});

// 元件 C：另一個訂閱者
bus.subscribe("user:login", (user) => {
  initUserPreferences(user.userId);
});
```

## Vue 中的事件匯流排

```javascript
// main.js
Vue.prototype.$bus = new Vue()

// 元件 A
this.$bus.$emit('global-event', payload)

// 元件 B
this.$bus.$on('global-event', (payload) => { ... })
// 別忘了在 beforeDestroy 取消訂閱！
this.$bus.$off('global-event', handler)
```

## 兩者對比

|      | 觀察者                   | 釋出訂閱            |
| 
---- | ------------------------ | ------------------- |
| 耦合 | 強（直接引用）           | 松（通過中間層）    |
| 適合 | 同一模組內通訊           | 跨模組/元件通訊     |
| 示例 | DOM 事件、Vue 元件 $emit | Vue 事件匯流排、Redux |

## 小結

- 觀察者：被觀察者直接通知觀察者，適合緊密關聯的物件
- 釋出訂閱：通過事件匯流排解耦，釋出者和訂閱者互不知情
- Vue 的 `$emit` 是觀察者（父知道子），事件匯流排是釋出訂閱
