---
title: "JavaScript 设计模式：观察者与发布订阅"
date: 2018-10-09 10:17:43
tags:
  - 前端
---

这两个模式经常被混为一谈，但有本质区别。

## 观察者模式（Observer Pattern）

被观察者（Subject）和观察者（Observer）直接通信，强耦合：

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

Node.js 的 `EventEmitter` 就是这个模式的实现。

## 发布订阅模式（Pub/Sub）

引入中间层（事件总线/消息中心），发布者和订阅者完全不认识对方：

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

// 全局事件总线
const bus = new EventBus();

// 组件 A：发布者
bus.publish("user:login", { userId: 123, name: "Alice" });

// 组件 B：订阅者（不知道 A 的存在）
bus.subscribe("user:login", (user) => {
  updateNavBar(user.name);
});

// 组件 C：另一个订阅者
bus.subscribe("user:login", (user) => {
  initUserPreferences(user.userId);
});
```

## Vue 中的事件总线

```javascript
// main.js
Vue.prototype.$bus = new Vue()

// 组件 A
this.$bus.$emit('global-event', payload)

// 组件 B
this.$bus.$on('global-event', (payload) => { ... })
// 别忘了在 beforeDestroy 取消订阅！
this.$bus.$off('global-event', handler)
```

## 两者对比

|      | 观察者                   | 发布订阅            |
| ---- | ------------------------ | ------------------- |
| 耦合 | 强（直接引用）           | 松（通过中间层）    |
| 适合 | 同一模块内通信           | 跨模块/组件通信     |
| 示例 | DOM 事件、Vue 组件 $emit | Vue 事件总线、Redux |

## 小结

- 观察者：被观察者直接通知观察者，适合紧密关联的对象
- 发布订阅：通过事件总线解耦，发布者和订阅者互不知情
- Vue 的 `$emit` 是观察者（父知道子），事件总线是发布订阅
