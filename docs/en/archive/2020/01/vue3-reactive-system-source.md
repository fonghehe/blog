---
title: "Vue 3 Reactivity System Source Code Analysis"
date: 2020-01-03 16:10:29
tags:
  - Vue
readingTime: 2
description: "Vue 3's reactivity system was rewritten on top of ES6 Proxy, completely replacing Vue 2's `Object.defineProperty` approach. Understanding its source implementation helps us write more efficient code and avoid subtle performance pitfalls."
wordCount: 227
---

Vue 3's reactivity system was rewritten on top of ES6 Proxy, completely leaving behind Vue 2's `Object.defineProperty` approach. Understanding its source implementation not only helps us write more efficient code, but also lets us avoid some hidden performance pitfalls.

## Proxy and Reflect Working Together

Vue 3 uses `Proxy` to intercept an object's read and write operations, and pairs it with `Reflect` to keep `this` pointing correctly.

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key) // 依赖收集
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver)
      trigger(target, key) // 触发更新
      return result
    }
  })
}

// 使用示例
const original = { name: 'Vue', version: 3 }
const observed = reactive(original)

// 这次读取会触发 get 拦截，自动收集依赖
console.log(observed.name)

// 这次赋值会触发 set 拦截，自动触发更新
observed.version = 3.1
```

Compared with Vue 2's `Object.defineProperty`, Proxy can intercept property addition and deletion, so `Vue.set` and `Vue.delete` are no longer needed.

## Map Structure for Dependency Tracking

The reactivity system stores dependencies in a three-level Map structure: `targetMap -> depsMap -> dep`.

```javascript
const targetMap = new WeakMap()

function track(target, key) {
  if (!activeEffect) return
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let dep = depsMap.get(key)
  if (!dep) {
    dep = new Set()
    depsMap.set(key, dep)
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const dep = depsMap.get(key)
  if (dep) {
    dep.forEach(effect => {
      effect.scheduler
        ? effect.scheduler(effect)
        : effect()
    })
  }
}
```

The `WeakMap` ensures that when a `target` is garbage-collected, its dependency info is cleared automatically, avoiding memory leaks.

## Difference Between ref and reactive

A `ref` is essentially a wrapper around a primitive, internally wrapping a `{ value: ... }` object with `reactive`.

```javascript
function ref(rawValue) {
  if (isRef(rawValue)) return rawValue
  return new RefImpl(rawValue)
}

class RefImpl {
  constructor(value) {
    this._value = convert(value) // 对象类型会用 reactive 包裹
    this.__v_isRef = true
  }

  get value() {
    track(this, 'value') // 收集 value 属性的依赖
    return this._value
  }

  set value(newVal) {
    if (hasChanged(newVal, this._value)) {
      this._value = convert(newVal)
      trigger(this, 'value') // 触发更新
    }
  }
}

// 使用
const count = ref(0)
console.log(count.value) // 0
count.value++

// 也可以包裹对象
const user = ref({ name: 'test' })
user.value.name = 'updated' // 这也会触发响应式
```

## Lazy Evaluation in computed

A `computed` returns a cached `ref`. It only recomputes when a dependency changes.

```javascript
function computed(getter) {
  let value
  let dirty = true // 是否需要重新计算

  const effect = new ReactiveEffect(getter, () => {
    // 依赖变化时的 scheduler
    if (!dirty) {
      dirty = true
      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effect.run()
        dirty = false
      }
      track(obj, 'value')
      return value
    }
  }
  return obj
}

// 使用
const count = ref(1)
const doubled = computed(() => count.value * 2)

console.log(doubled.value) // 2，首次计算
console.log(doubled.value) // 2，直接返回缓存
count.value = 5
console.log(doubled.value) // 10，重新计算
```

## Summary

- Proxy replaces defineProperty, fixing the problem where adding/deleting properties wasn't reactive.
- Dependency tracking uses a WeakMap -> Map -> Set three-level structure, with WeakMap handling garbage collection automatically.
- A `ref` is essentially a `reactive` wrapped in a `{ value }` object.
- `computed` uses a `dirty` flag to achieve lazy evaluation and caching.
- Understanding the underlying mechanism helps debug tricky cases where reactivity doesn't kick in.
