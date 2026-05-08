---
title: "Vue 3 响应式系统源码分析"
date: 2020-01-03 16:10:29
tags:
  - Vue
---

Vue 3 的响应式系统基于 ES6 Proxy 重写，彻底告别了 Vue 2 的 `Object.defineProperty` 方案。理解其源码实现，不仅能帮助我们写出更高效的代码，还能避免一些隐蔽的性能陷阱。

## Proxy 与 Reflect 的配合

Vue 3 使用 `Proxy` 拦截对象的读写操作，配合 `Reflect` 确保 `this` 指向正确。

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

相比 Vue 2 的 `Object.defineProperty`，Proxy 可以拦截新增属性和删除操作，不需要 `Vue.set` 和 `Vue.delete`。

## 依赖收集的 Map 结构

响应式系统用一个三层 Map 结构存储依赖关系：`targetMap -> depsMap -> dep`。

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

`WeakMap` 确保当 `target` 被垃圾回收时，对应的依赖信息自动清除，避免内存泄漏。

## ref 与 reactive 的区别

`ref` 本质上是对基本类型的包装，内部用 `reactive` 包裹一个 `{ value: ... }` 对象。

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

## computed 的惰性求值

`computed` 返回一个带有缓存的 ref。只有依赖变化时才会重新计算。

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

## 小结

- Proxy 替代 defineProperty，解决新增/删除属性无响应式的问题
- 依赖收集用 WeakMap -> Map -> Set 三层结构，WeakMap 自动处理垃圾回收
- ref 本质是包了一层 `{ value }` 的 reactive
- computed 通过 dirty 标记实现惰性求值和缓存
- 理解底层机制有助于排查响应式不生效的疑难杂症
