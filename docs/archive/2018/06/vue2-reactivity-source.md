---
title: "Vue 2 源码阅读：响应式原理"
date: 2018-06-05 10:32:51
tags:
  - Vue
readingTime: 2
description: "Vue 的响应式系统是它最核心的特性，很多面试题都围绕这个展开。这篇文章通过阅读 Vue 2.x 源码，理清它的实现原理。"
wordCount: 316
---

Vue 的响应式系统是它最核心的特性，很多面试题都围绕这个展开。这篇文章通过阅读 Vue 2.x 源码，理清它的实现原理。

## 核心：Object.defineProperty

Vue 2 的响应式基于 `Object.defineProperty`，对数据的每个属性设置 getter/setter：

```javascript
function defineReactive(obj, key, value) {
  const dep = new Dep(); // 依赖收集器

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (Dep.target) {
        // 有正在计算的 Watcher
        dep.depend(); // 收集依赖
      }
      return value;
    },
    set(newValue) {
      if (newValue === value) return;
      value = newValue;
      dep.notify(); // 通知所有 Watcher 更新
    },
  });
}
```

## Observer：递归处理整个对象

```javascript
class Observer {
  constructor(value) {
    this.value = value;

    if (Array.isArray(value)) {
      // 数组特殊处理
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }

  walk(obj) {
    Object.keys(obj).forEach((key) => {
      defineReactive(obj, key, obj[key]);
    });
  }

  observeArray(arr) {
    arr.forEach((item) => observe(item));
  }
}

function observe(value) {
  if (typeof value !== "object") return;
  return new Observer(value);
}
```

## Dep：依赖管理

每个响应式属性都有一个 `Dep` 实例，管理依赖它的所有 `Watcher`：

```javascript
class Dep {
  constructor() {
    this.subscribers = new Set();
  }

  depend() {
    if (Dep.target) {
      this.subscribers.add(Dep.target);
    }
  }

  notify() {
    this.subscribers.forEach((watcher) => watcher.update());
  }
}

Dep.target = null; // 当前正在计算的 Watcher
```

## Watcher：观察者

每个计算属性、watch 选项、渲染函数都对应一个 `Watcher`：

```javascript
class Watcher {
  constructor(vm, expOrFn, callback) {
    this.vm = vm;
    this.cb = callback;
    this.getter = typeof expOrFn === "function" ? expOrFn : () => vm[expOrFn];

    this.value = this.get(); // 初始化时触发 getter，完成依赖收集
  }

  get() {
    Dep.target = this; // 设置当前 Watcher
    const value = this.getter.call(this.vm); // 触发数据 getter
    Dep.target = null; // 清除
    return value;
  }

  update() {
    const oldValue = this.value;
    this.value = this.get();
    this.cb.call(this.vm, this.value, oldValue);
  }
}
```

## 完整流程

```
data: { count: 0 }
   ↓ Vue.observe()
count 属性被 defineProperty，创建 Dep

组件渲染函数执行
   ↓ 访问 this.count
触发 count 的 getter
   ↓ Dep.target = 渲染 Watcher
dep.depend() → 渲染 Watcher 加入 dep.subscribers

this.count++
   ↓ 触发 count 的 setter
dep.notify() → 通知所有 subscribers
   ↓ 渲染 Watcher.update()
组件重新渲染
```

## Vue 2 响应式的局限性

理解了原理，就能理解为什么有这些限制：

### 无法检测属性的添加/删除

```javascript
// ❌ 这个添加不是响应式的
this.user.age = 18; // 没有被 defineProperty，不会触发更新

// ✅ 用 Vue.set
this.$set(this.user, "age", 18);
```

原因：`defineProperty` 只能拦截已存在的属性，无法拦截新增属性。

### 无法检测数组下标赋值

```javascript
// ❌ 不会触发更新
this.list[0] = "new value";
this.list.length = 0;

// ✅ 用数组方法
this.list.splice(0, 1, "new value");
this.list.splice(0);

// ✅ 或者整体替换
this.list = [...this.list];
```

Vue 对数组的 push/pop/splice 等方法做了拦截，这些方法会触发更新。

## Vue 2 vs Vue 3 的响应式

Vue 3 用 `Proxy` 替代 `Object.defineProperty`，解决了以上限制：

```javascript
// Proxy 可以拦截属性添加和删除
const proxy = new Proxy(obj, {
  set(target, key, value) {
    const oldValue = target[key];
    target[key] = value;
    trigger(target, key); // 触发更新
    return true;
  },
});

proxy.newProp = "value"; // 能被检测到！
```

## 小结

- Vue 2 响应式基于 `Object.defineProperty` + Dep/Watcher 模式
- Observer 递归处理对象属性，Dep 管理依赖，Watcher 响应变化
- `Object.defineProperty` 的限制导致无法检测属性新增/删除
- Vue 3 用 Proxy 解决了这些限制
