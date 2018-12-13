---
title: "JavaScript Proxy 和 Reflect 元编程"
date: 2018-12-13 16:17:56
tags:
  - JavaScript
---

Proxy 是 ES2015 加入的，但一直用得不多。Vue 3 的响应式系统基于 Proxy，是时候好好了解一下了。

## Proxy 基础

Proxy 可以拦截对象的各种操作：

```javascript
const handler = {
  // 拦截属性读取
  get(target, prop, receiver) {
    console.log(`读取 ${prop}`);
    return Reflect.get(target, prop, receiver);
  },

  // 拦截属性设置
  set(target, prop, value, receiver) {
    console.log(`设置 ${prop} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },

  // 拦截 delete
  deleteProperty(target, prop) {
    console.log(`删除 ${prop}`);
    return Reflect.deleteProperty(target, prop);
  },

  // 拦截 in 操作符
  has(target, prop) {
    return prop !== "secret" && Reflect.has(target, prop);
  },
};

const obj = { name: "Alice", secret: "密码" };
const proxy = new Proxy(obj, handler);

proxy.name; // 日志：读取 name
proxy.age = 25; // 日志：设置 age = 25
"secret" in proxy; // false（被拦截了）
```

## 实现响应式（Vue 3 原理）

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, prop, receiver) {
      // 依赖收集
      track(target, prop);
      const value = Reflect.get(target, prop, receiver);
      // 如果值是对象，递归代理
      return typeof value === "object" && value !== null
        ? reactive(value)
        : value;
    },

    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      // 触发更新
      trigger(target, prop);
      return result;
    },
  });
}

const state = reactive({ count: 0, user: { name: "Alice" } });

effect(() => {
  console.log("count:", state.count); // 自动追踪依赖
});

state.count++; // 触发 effect 重新运行
state.user.name = "Bob"; // 深层属性也能追踪！（Object.defineProperty 做不到）
```

Vue 2 用 `Object.defineProperty` 不能：

- 检测新增属性（需要 `Vue.set`）
- 检测数组索引赋值

Vue 3 用 Proxy 解决了这些问题。

## Reflect：标准化对象操作

`Reflect` 提供了和 Proxy handler 方法对应的静态方法：

```javascript
// 以前的写法
Object.defineProperty(obj, "name", { value: "Alice" });
"name" in obj;
delete obj.name;

// Reflect 写法（更统一，返回布尔值表示是否成功）
Reflect.defineProperty(obj, "name", { value: "Alice" });
Reflect.has(obj, "name");
Reflect.deleteProperty(obj, "name");

// Reflect.get 确保 this 正确（receiver 参数）
Reflect.get(target, prop, receiver); // receiver 是 proxy 本身
```

## 实用应用：数据验证

```javascript
function createValidator(target, validators) {
  return new Proxy(target, {
    set(target, prop, value) {
      const validator = validators[prop];
      if (validator && !validator(value)) {
        throw new TypeError(`${prop} 的值 "${value}" 不合法`);
      }
      return Reflect.set(target, prop, value);
    },
  });
}

const user = createValidator(
  {},
  {
    age: (v) => Number.isInteger(v) && v >= 0 && v <= 150,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
);

user.age = 25; // ✅
user.age = -1; // ❌ TypeError
user.email = "invalid"; // ❌ TypeError
```

## 小结

- Proxy 拦截对象的各种操作（get/set/delete 等），能力比 defineProperty 强
- Reflect 提供统一的对象操作 API，通常和 Proxy handler 配合使用
- Vue 3 基于 Proxy 实现响应式，解决了 Vue 2 的新增属性检测问题
- Proxy 无法被 polyfill，只能在支持 ES2015+ 的环境使用
