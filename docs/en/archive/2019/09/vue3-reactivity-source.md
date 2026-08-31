---
title: "Vue 3 Alpha Source: Reactivity System Internals"
date: 2019-09-24 15:06:04
tags:
  - Vue
readingTime: 2
description: "The Vue 3 alpha source code is public! I went straight to look at the reactivity system (`packages/reactivity`), and it's a big change from Vue 2."
wordCount: 138
---

The Vue 3 alpha source code is public! I went straight to look at the reactivity system (`packages/reactivity`), and it's a big change from Vue 2.

## Vue 2 Reactivity Limitations

```javascript
// Vue 2 用 Object.defineProperty
// 问题 1：无法检测新增属性
const vm = new Vue({ data: { user: { name: "Alice" } } });
vm.user.age = 25; // 不触发更新！需要 Vue.set(vm.user, 'age', 25)

// 问题 2：无法检测数组索引赋值
vm.items[0] = newItem; // 不触发更新！需要 Vue.set 或 splice

// 问题 3：初始化时需要遍历所有属性（性能）
```

## Vue 3's Proxy-Based Reactivity

```javascript
// packages/reactivity/src/reactive.ts（简化版）

function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 依赖追踪
      track(target, TrackOpTypes.GET, key);

      const res = Reflect.get(target, key, receiver);

      // 懒递归：只有访问到嵌套对象时才代理
      if (isObject(res)) {
        return reactive(res);
      }

      return res;
    },

    set(target, key, value, receiver) {
      const hadKey = hasOwn(target, key);
      const result = Reflect.set(target, key, value, receiver);

      if (!hadKey) {
        // 新增属性：触发 ADD 类型
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        // 修改属性：触发 SET 类型
        trigger(target, TriggerOpTypes.SET, key, value, oldValue);
      }

      return result;
    },

    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      if (result && hasOwn(target, key)) {
        trigger(target, TriggerOpTypes.DELETE, key, undefined);
      }
      return result;
    },
  });
}
```

## effect, track, trigger

```javascript
// 当前活跃的 effect
let activeEffect = null;

// effect：定义响应式副作用
function effect(fn) {
  const effectFn = () => {
    activeEffect = effectFn;
    fn(); // 执行时自动追踪依赖
    activeEffect = null;
  };
  effectFn(); // 立即执行一次
  return effectFn;
}

// track：在 get 中调用，收集依赖
// targetMap: WeakMap<target, Map<key, Set<effect>>>
const targetMap = new WeakMap();

function track(target, type, key) {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));

  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));

  dep.add(activeEffect);
}

// trigger：在 set 中调用，触发更新
function trigger(target, type, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const effects = depsMap.get(key) || new Set();
  effects.forEach((effect) => effect());
}
```

## ref Implementation

```javascript
// ref 用于基本类型（不能用 Proxy，因为 Proxy 只能代理对象）
function ref(value) {
  return {
    get value() {
      track(this, TrackOpTypes.GET, "value");
      return value;
    },
    set value(newValue) {
      if (hasChanged(newValue, value)) {
        value = newValue;
        trigger(this, TriggerOpTypes.SET, "value", newValue);
      }
    },
  };
}
```

## computed Implementation

```javascript
function computed(getter) {
  let dirty = true; // 脏标记：true 表示需要重新计算
  let value;

  const runner = effect(getter, {
    lazy: true, // 不立即执行
    scheduler: () => {
      dirty = true; // 依赖变化时标记为脏，不立即重计算
    },
  });

  return {
    get value() {
      if (dirty) {
        value = runner(); // 只有访问时才计算
        dirty = false;
      }
      track(this, TrackOpTypes.GET, "value");
      return value;
    },
  };
}
```

## Performance Comparison with Vue 2

| | Vue 2 | Vue 3 |
| -------- | -------------------------- | ---------------------- |
| Initialization | Recursively walks all properties | Lazy proxying (only when accessed) |
| New properties | Not tracked (needs `$set`) | Tracked automatically |
| Arrays | Overrides 7 methods | Native support |
| Memory | Creates a getter/setter per property | `WeakMap` manages dependencies |

## Summary

- `Proxy` is more powerful than `defineProperty`: it intercepts add, delete, and array-index operations.
- Lazy recursive proxying (proxying only when accessed) is more efficient than Vue 2's full recursive initialization.
- `track` collects dependencies and `trigger` fires updates—the heart of the whole reactivity system.
- `computed` uses a dirty flag for lazy evaluation, recomputing only when accessed.
