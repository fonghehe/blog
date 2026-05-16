---
title: "Vue 3 Alpha Source: Reactivity System Internals"
date: 2019-09-24 15:06:04
tags:
  - Vue
readingTime: 2
description: "Vue 3 alpha 代码公开了！第一时间去看了响应式系统（packages/reactivity），相比 Vue 2 改变很大。"
---

Vue 3 alpha 代码公开了！第一时间去看了响应式系统（packages/reactivity），相比 Vue 2 改变很大。

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

## Vue 3 基于 Proxy 的响应式

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

|          | Vue 2                      | Vue 3                  |
| -------- | -------------------------- | ---------------------- |
| 初始化   | 递归遍历所有属性           | 懒代理（访问到才代理） |
| 新增属性 | 不追踪（需要 $set）        | 自动追踪               |
| 数组     | 重写 7 个方法              | 原生支持               |
| 内存     | 每个属性创建 getter/setter | WeakMap 管理依赖       |

## Summary

- Proxy 比 defineProperty 更强大：拦截新增、删除、数组索引操作
- 懒递归代理（访问时才 reactive）比 Vue 2 初始化时全量递归更高效
- `track` 收集依赖，`trigger` 触发更新，是整个响应式的核心
- `computed` 用脏标记实现懒求值，只有访问时才重新计算
