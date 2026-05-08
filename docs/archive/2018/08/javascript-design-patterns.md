---
title: "JavaScript 设计模式：观察者、策略、代理"
date: 2018-08-14 14:48:01
tags:
  - JavaScript
  - 设计模式
---

设计模式不是背面试题用的，是真实项目里解决特定问题的工具。记录三个我实际用到过的模式。

## 观察者模式（发布/订阅）

用于解耦：A 不需要直接知道 B，只需要发布事件，B 自己订阅。

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
bus.on("data:loaded", (data) => console.log("数据加载完成", data));
bus.emit("data:loaded", { list: [] });
```

Vue 的 `$on/$emit` 本质就是这个模式。

## 策略模式

把多个 if/else 分支替换成策略对象，让代码更易扩展。

```javascript
// 糟糕写法：if/else 不断增长
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

// 策略模式：每种策略单独定义
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

// 加新折扣类型只需加一个属性，不动原有逻辑
discountStrategies.employee = (price) => price * 0.5;
```

在前端表单验证里也常用：

```javascript
const validators = {
  required: (value) => !!value || "不能为空",
  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "邮箱格式不正确",
  minLength: (min) => (value) => value.length >= min || `最少${min}个字符`,
};
```

## 代理模式

在访问某个对象之前加一层代理，用于缓存、权限控制、懒加载等。

```javascript
// 缓存代理：避免重复计算
function createCacheProxy(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      console.log("命中缓存");
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveCalc = (n) => {
  // 假设是很慢的计算
  return n * n;
};
const cachedCalc = createCacheProxy(expensiveCalc);
cachedCalc(10); // 计算
cachedCalc(10); // 命中缓存，直接返回

// ES6 Proxy：更强大
const handler = {
  get(target, key) {
    console.log(`访问了 ${String(key)}`);
    return Reflect.get(target, key);
  },
  set(target, key, value) {
    if (typeof value !== "number") {
      throw new TypeError(`${String(key)} 必须是数字`);
    }
    return Reflect.set(target, key, value);
  },
};

const validator = new Proxy({}, handler);
validator.age = 25; // 正常
validator.age = "25"; // TypeError
```

## 小结

- 观察者模式：解耦事件发布和订阅，Vue 的 $on/$emit 就是它
- 策略模式：消除 if/else，把分支逻辑变成可扩展的策略对象
- 代理模式：在访问对象前加一层控制，用于缓存、验证、日志等
- 设计模式是工具，不要为了用而用