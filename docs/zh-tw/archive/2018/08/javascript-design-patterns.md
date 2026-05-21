---
title: "JavaScript 設計模式：觀察者、策略、代理"
date: 2018-08-14 14:48:01
tags:
  - JavaScript
  - 設計模式
readingTime: 2
description: "設計模式不是背面試題用的，是真實專案裡解決特定問題的工具。記錄三個我實際用到過的模式。"
wordCount: 247
---

設計模式不是背面試題用的，是真實專案裡解決特定問題的工具。記錄三個我實際用到過的模式。

## 觀察者模式（釋出/訂閱）

用於解耦：A 不需要直接知道 B，只需要釋出事件，B 自己訂閱。

```javascript
class EventEmitter {
  constructor() {
    this._events = {};
  }

  on(event, listener) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter((l) => l !== listener);
    return this;
  }

  emit(event, ...args) {
    if (!this._events[event]) return;
    this._events[event].forEach((listener) => listener(...args));
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener(...args);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// 使用
const bus = new EventEmitter();
bus.on("data:loaded", (data) => console.log("資料載入完成", data));
bus.emit("data:loaded", { list: [] });
```

Vue 的 `$on/$emit` 本質就是這個模式。

## 策略模式

把多個 if/else 分支替換成策略物件，讓程式碼更易擴充套件。

```javascript
// 糟糕寫法：if/else 不斷增長
function calculateDiscount(type, price) {
  if (type === "vip") {
    return price * 0.8;
  } else if (type === "svip") {
    return price * 0.6;
  } else if (type === "newUser") {
    return price - 10;
  } else {
    return price;
  }
}

// 策略模式：每種策略單獨定義
const discountStrategies = {
  vip: (price) => price * 0.8,
  svip: (price) => price * 0.6,
  newUser: (price) => price - 10,
  default: (price) => price,
};

function calculateDiscount(type, price) {
  const strategy = discountStrategies[type] || discountStrategies.default;
  return strategy(price);
}

// 加新折扣型別只需加一個屬性，不動原有邏輯
discountStrategies.employee = (price) => price * 0.5;
```

在前端表單驗證裡也常用：

```javascript
const validators = {
  required: (value) => !!value || "不能為空",
  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "郵箱格式不正確",
  minLength: (min) => (value) => value.length >= min || `最少${min}個字元`,
};
```

## 代理模式

在訪問某個物件之前加一層代理，用於快取、許可權控制、懶載入等。

```javascript
// 快取代理：避免重複計算
function createCacheProxy(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      console.log("命中快取");
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = (n) => {
  // 假設是很慢的計算
  return n * n;
};
const cachedCalc = createCacheProxy(expensiveCalc);
cachedCalc(10); // 計算
cachedCalc(10); // 命中快取，直接返回

// ES6 Proxy：更強大
const handler = {
  get(target, key) {
    console.log(`訪問了 ${String(key)}`);
    return Reflect.get(target, key);
  },
  set(target, key, value) {
    if (typeof value !== "number") {
      throw new TypeError(`${String(key)} 必須是數字`);
    }
    return Reflect.set(target, key, value);
  },
};

const validator = new Proxy({}, handler);
validator.age = 25; // 正常
validator.age = "25"; // TypeError
```

## 小結

- 觀察者模式：解耦事件釋出和訂閱，Vue 的 $on/$emit 就是它
- 策略模式：消除 if/else，把分支邏輯變成可擴充套件的策略物件
- 代理模式：在訪問物件前加一層控制，用於快取、驗證、日誌等
- 設計模式是工具，不要為了用而用