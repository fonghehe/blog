---
title: "Vue 3 Reactivity In Depth: Why Proxy Replaces defineProperty"
date: 2019-10-23 17:10:53
tags:
  - Vue
readingTime: 1
description: "Vue 3 completely rewrote its reactivity system from `Object.defineProperty` to `Proxy`. This wasn't done just to follow a trend—it was to fundamentally fix some deep-rooted flaws in Vue 2."
wordCount: 126
---

Vue 3 completely rewrote its reactivity system from `Object.defineProperty` to `Proxy`. This wasn't done just to follow a trend—it was to fundamentally fix some deep-rooted flaws in Vue 2.

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

`Object.defineProperty` walks the object's properties at creation time to attach getters/setters, so any property added later naturally has no interception.

## Vue 3's Proxy Approach

`Proxy` can intercept every operation on an object, including adding and deleting properties:

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

The upgrade of Vue 3's reactivity system is more than just a change in tech choice—it's a thorough fix for the original design's limitations. The full-intercept capability of `Proxy` combined with a `WeakMap`-indexed dependency graph has proven to be better in both performance and correctness.
