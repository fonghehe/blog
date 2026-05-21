---
title: "JavaScript デザインパターン：オブザーバーとパブリッシュ/サブスクライブ"
date: 2018-10-09 10:17:43
tags:
  - フロントエンド
readingTime: 2
description: "この2つのパターンはよく混同されますが、本質的な違いがあります。"
wordCount: 387
---

この2つのパターンはよく混同されますが、本質的な違いがあります。

## オブザーバーパターン（Observer Pattern）

被観察者（Subject）とオブザーバー（Observer）が直接通信する、密結合なパターン：

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

// 使用例
const emitter = new EventEmitter();
emitter.on("data", (data) => console.log("受信:", data));
emitter.emit("data", { id: 1 });
```

Node.js の `EventEmitter` はこのパターンの実装です。

## パブリッシュ/サブスクライブパターン（Pub/Sub）

中間層（イベントバス/メッセージブローカー）を導入し、パブリッシャーとサブスクライバーが互いを全く知らない状態：

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

// グローバルイベントバス
const bus = new EventBus();

// コンポーネント A：パブリッシャー
bus.publish("user:login", { userId: 123, name: "Alice" });

// コンポーネント B：サブスクライバー（A の存在を知らない）
bus.subscribe("user:login", (user) => {
  updateNavBar(user.name);
});

// コンポーネント C：別のサブスクライバー
bus.subscribe("user:login", (user) => {
  initUserPreferences(user.userId);
});
```

## Vue のイベントバス

```javascript
// main.js
Vue.prototype.$bus = new Vue()

// コンポーネント A
this.$bus.$emit('global-event', payload)

// コンポーネント B
this.$bus.$on('global-event', (payload) => { ... })
// beforeDestroy でサブスクライブ解除を忘れずに！
this.$bus.$off('global-event', handler)
```

## 比較

|      | オブザーバー                 | パブリッシュ/サブスクライブ         |
| ---- | ---------------------------- | ----------------------------------- |
| 結合 | 密（直接参照）               | 疎（中間層経由）                    |
| 適用 | 同一モジュール内の通信       | クロスモジュール/コンポーネント通信 |
| 例   | DOM イベント、Vue の `$emit` | Vue イベントバス、Redux             |

## まとめ

- オブザーバー：被観察者がオブザーバーに直接通知する — 密接に関連するオブジェクトに適している
- パブリッシュ/サブスクライブ：イベントバスで疎結合化 — パブリッシャーとサブスクライバーはお互いを知らない
- Vue の `$emit` はオブザーバー（親が子を知っている）、イベントバスはパブリッシュ/サブスクライブ
