---
title: "JavaScriptのよく使うデザインパターン実践"
date: 2019-06-20 17:03:37
tags:
  - JavaScript
readingTime: 2
description: "デザインパターンはバックエンド専用ではありません——フロントエンドのコードでも広く使われています。これらのパターンをマスターすることで、コードがよりエレガントで保守しやすくなります。"
---

デザインパターンはバックエンド専用ではありません——フロントエンドのコードでも広く使われています。これらのパターンをマスターすることで、コードがよりエレガントで保守しやすくなります。

## シングルトンパターン

クラスのインスタンスが1つだけであることを保証し、同じオブジェクトをグローバルに共有します。フロントエンドで最もよくあるシナリオ：グローバル状態管理、モーダル管理、認証状態。

```javascript
// 実装1：クロージャ
const Singleton = (function () {
  let instance;

  function createInstance(options) {
    return {
      name: options.name,
      log() {
        console.log(`インスタンス名: ${this.name}`);
      },
    };
  }

  return {
    getInstance(options) {
      if (!instance) {
        instance = createInstance(options);
      }
      return instance;
    },
  };
})();

const s1 = Singleton.getInstance({ name: "app" });
const s2 = Singleton.getInstance({ name: "other" });
console.log(s1 === s2); // true — 常に同じインスタンス
```

```javascript
// 実装2：ES6クラス + スタティックメソッド
class ModalManager {
  static instance = null;

  constructor() {
    this.modals = [];
  }

  static getInstance() {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  open(config) {
    const modal = { id: Date.now(), ...config, visible: true };
    this.modals.push(modal);
    return modal.id;
  }

  close(id) {
    const index = this.modals.findIndex((m) => m.id === id);
    if (index > -1) this.modals.splice(index, 1);
  }
}
```

## オブザーバーパターン

```javascript
class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(event, handler) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event).add(handler);
    // 購読解除関数を返す
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.events.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.events.get(event)?.forEach((handler) => handler(data));
  }
}

const bus = new EventBus();
const unsubscribe = bus.on("user:login", (user) =>
  console.log("ユーザーがログイン:", user),
);
bus.emit("user:login", { name: "アリス" });
unsubscribe(); // クリーンアップ
```

## ストラテジーパターン

```javascript
// ストラテジーなし：大きなswitch/if-else
function calculateDiscount(type, price) {
  if (type === "vip") return price * 0.8;
  if (type === "member") return price * 0.9;
  if (type === "newuser") return price - 20;
  return price;
}

// ストラテジーあり：拡張可能、開放閉鎖原則に従う
const discountStrategies = {
  vip: (price) => price * 0.8,
  member: (price) => price * 0.9,
  newuser: (price) => Math.max(0, price - 20),
  default: (price) => price,
};

function calculateDiscount(type, price) {
  const strategy = discountStrategies[type] || discountStrategies.default;
  return strategy(price);
}

// 新しい割引タイプの追加は既存コードへの変更ゼロ
discountStrategies.superVip = (price) => price * 0.7;
```

シングルトン・オブザーバー・ストラテジーの3つのパターンは、実際のフロントエンドシナリオの大部分をカバーします。マスターすることでよりクリーンで保守しやすいコードが書けます。
