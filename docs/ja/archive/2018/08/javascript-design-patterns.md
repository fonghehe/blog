---
title: "JavaScriptデザインパターン：オブザーバー、ストラテジー、プロキシ"
date: 2018-08-14 14:48:01
tags:
  - JavaScript
  - デザインパターン
readingTime: 3
description: "デザインパターンは頻繁に発生する問題に対する再利用可能な解決策です。フロントエンドプロジェクトでよく使う3つのパターンを紹介します。"
---

デザインパターンは頻繁に発生する問題に対する再利用可能な解決策です。フロントエンドプロジェクトでよく使う3つのパターンを紹介します。

## オブザーバーパターン

オブザーバーパターンは一対多の依存関係を定義します。1つのオブジェクトの状態が変化すると、依存するすべてのオブジェクトに自動的に通知されます。

```javascript
class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  // サブスクライブ
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this; // チェーン呼び出しをサポート
  }

  // サブスクライブ解除
  off(event, callback) {
    if (!this.listeners[event]) return this;
    this.listeners[event] = this.listeners[event].filter(
      (cb) => cb !== callback,
    );
    return this;
  }

  // イベントをトリガー
  emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
    return this;
  }

  // 一度だけサブスクライブ
  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// 使用例
const emitter = new EventEmitter();

emitter
  .on("data", (data) => console.log("ハンドラー1:", data))
  .on("data", (data) => console.log("ハンドラー2:", data))
  .once("connect", () => console.log("接続しました"));

emitter.emit("data", { id: 1 }); // 両方のハンドラーをトリガー
emitter.emit("connect"); // 一度だけトリガー
```

## ストラテジーパターン

ストラテジーパターンはアルゴリズムのファミリーを定義して交換可能にし、クライアントコードを変えずに使えるようにします。

**例：割引計算**

```javascript
// ストラテジーを定義
const discountStrategies = {
  none: (price) => price,
  member: (price) => price * 0.9,
  vip: (price) => price * 0.8,
  flash: (price) => price * 0.5,
};

// コンテキスト
class Order {
  constructor(price, discountType) {
    this.price = price;
    this.strategy = discountStrategies[discountType] || discountStrategies.none;
  }

  calculateTotal() {
    return this.strategy(this.price);
  }
}

const order = new Order(100, "vip");
console.log(order.calculateTotal()); // 80

// 新しい割引タイプを追加してもOrderを変更する必要がない
discountStrategies.blackFriday = (price) => price * 0.7;
```

**例：フォームバリデーション**

```javascript
const validators = {
  required: (value) => (value.trim() ? null : "このフィールドは必須です"),
  email: (value) =>
    /^\S+@\S+\.\S+$/.test(value)
      ? null
      : "有効なメールアドレスを入力してください",
  minLength: (min) => (value) =>
    value.length >= min ? null : `${min}文字以上で入力してください`,
  maxLength: (max) => (value) =>
    value.length <= max ? null : `${max}文字以内で入力してください`,
};

function validate(value, rules) {
  for (const rule of rules) {
    const error =
      typeof rule === "function" ? rule(value) : validators[rule]?.(value);
    if (error) return error;
  }
  return null;
}

// 使用例
const error = validate("hi", ["required", validators.minLength(3), "email"]);
```

## プロキシパターン

プロキシパターンは別のオブジェクトへのアクセスを制御するための代理オブジェクトを提供します。

**キャッシュプロキシ：**

```javascript
function createCachingProxy(fn) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      console.log("キャッシュから取得");
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

function expensiveCalculation(n) {
  console.log("計算中...");
  return n * n;
}

const cachedCalc = createCachingProxy(expensiveCalculation);
cachedCalc(10); // 計算中... → 100
cachedCalc(10); // キャッシュから取得 → 100
```

**ES6 Proxyによる型バリデーション：**

```javascript
function createTypeSafeObject(schema) {
  return new Proxy(
    {},
    {
      set(target, prop, value) {
        const type = schema[prop];
        if (type && typeof value !== type) {
          throw new TypeError(`${prop}は${type}型でなければなりません`);
        }
        target[prop] = value;
        return true;
      },
    },
  );
}

const user = createTypeSafeObject({ name: "string", age: "number" });
user.name = "Alice"; // OK
user.age = 25; // OK
user.age = "二十五"; // TypeError: ageはnumber型でなければなりません
```

## まとめ

- **オブザーバー**：イベント発行者とサブスクライバーを疎結合にする。コンポーネント通信やイベントシステムに最適
- **ストラテジー**：複雑な`if/else`をプラガブルなアルゴリズムファミリーで置き換える。拡張しやすい
- **プロキシ**：プロパティへのアクセスをインターセプトしてキャッシュ、バリデーション、ロギングなどを追加

デザインパターンはツールであってドグマではありません。実際の問題を解決するときに使いましょう。
