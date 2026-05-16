---
title: "Vue 3 Reactivity In Depth: Why Proxy Replaces defineProperty"
date: 2019-10-23 17:10:53
tags:
  - Vue
readingTime: 1
description: "Vue 3 将响应式系统从 `Object.defineProperty` 完全重写为 `Proxy`。这不是为了追时髦，而是为了彻底解决 Vue 2 中一些根本性缺陷。"
---

Vue 3 将响应式系统从 `Object.defineProperty` 完全重写为 `Proxy`。这不是为了追时髦，而是为了彻底解决 Vue 2 中一些根本性缺陷。

## Vue 2 Limitations

```javascript
// Vue 2 无法检测到这些变更：

// 1. 直接添加新属性
// this.obj.newProp = 'value'; // 不触发更新！

// 2. 通过索引修改数组
// this.arr[0] = 'new'; // 不触发更新！

// 必须用特殊 API
this.$set(this.obj, "newProp", "value");
this.$set(this.arr, 0, "new");
Vue.set(obj, key, value);
```

`Object.defineProperty` 在对象创建时遍历属性添加 getter/setter，所以后续新增的属性自然没有拦截。

## Vue 3's Proxy Approach

`Proxy` 可以拦截对象的所有操作，包括属性新增和删除：

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key); // 调用时追踪依赖
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key); // 设置时触发更新
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key); // 删除属性也能检测到！
      return result;
    },
  });
}
```

## track and trigger Principles

```javascript
// 依赖跟踪系统
// WeakMap<目标对象, Map<属性名, Set<副作用>>>
const targetMap = new WeakMap();
let activeEffect = null;

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  effects && effects.forEach((effect) => effect());
}

function effect(fn) {
  activeEffect = fn;
  fn(); // 执行时自动追踪当前访问了哪些属性
  activeEffect = null;
}
```

## Simple Usage Example

```javascript
const state = reactive({ count: 0 });

// effect 会在 state.count 变化时重新执行
effect(() => {
  console.log("count is:", state.count);
});
// 输出： count is: 0

state.count++; // 输出： count is: 1
state.newKey = 2; // Proxy 能检测到！输出： count is: 1——這次 effect 依赖 newKey
```

## ref Wrapping Primitive Types

```javascript
// 基本类型不能被 Proxy 拦截，用封装对象处理
function ref(value) {
  const r = {
    get value() {
      track(r, "value");
      return value;
    },
    set value(newVal) {
      value = newVal;
      trigger(r, "value");
    },
  };
  return r;
}

const count = ref(0);
effect(() => console.log(count.value));
count.value++; // 触发更新
```

## Summary

Vue 3 响应式系统的升级不只是技术选型的迭代，而是对原有设计局限的一次彻底修正。`Proxy` 的全拦截能力 + `WeakMap`索引的依赖图，这套设计已被证明性能和正确性都更好。
