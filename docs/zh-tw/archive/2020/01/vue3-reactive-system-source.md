---
title: "Vue 3 響應式系統原始碼分析"
date: 2020-01-03 16:10:29
tags:
  - Vue
readingTime: 2
description: "Vue 3 的響應式系統基於 ES6 Proxy 重寫，徹底告別了 Vue 2 的 `Object.defineProperty` 方案。理解其原始碼實現，不僅能幫助我們寫出更高效的程式碼，還能避免一些隱蔽的效能陷阱。"
wordCount: 339
---

Vue 3 的響應式系統基於 ES6 Proxy 重寫，徹底告別了 Vue 2 的 `Object.defineProperty` 方案。理解其原始碼實現，不僅能幫助我們寫出更高效的程式碼，還能避免一些隱蔽的效能陷阱。

## Proxy 與 Reflect 的配合

Vue 3 使用 `Proxy` 攔截物件的讀寫操作，配合 `Reflect` 確保 `this` 指向正確。

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key) // 依賴收集
      return Reflect.get(target, key, receiver)
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver)
      trigger(target, key) // 觸發更新
      return result
    }
  })
}

// 使用示例
const original = { name: 'Vue', version: 3 }
const observed = reactive(original)

// 這次讀取會觸發 get 攔截，自動收集依賴
console.log(observed.name)

// 這次賦值會觸發 set 攔截，自動觸發更新
observed.version = 3.1
```

相比 Vue 2 的 `Object.defineProperty`，Proxy 可以攔截新增屬性和刪除操作，不需要 `Vue.set` 和 `Vue.delete`。

## 依賴收集的 Map 結構

響應式系統用一個三層 Map 結構儲存依賴關係：`targetMap -> depsMap -> dep`。

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

`WeakMap` 確保當 `target` 被垃圾回收時，對應的依賴資訊自動清除，避免記憶體洩漏。

## ref 與 reactive 的區別

`ref` 本質上是對基本型別的包裝，內部用 `reactive` 包裹一個 `{ value: ... }` 物件。

```javascript
function ref(rawValue) {
  if (isRef(rawValue)) return rawValue
  return new RefImpl(rawValue)
}

class RefImpl {
  constructor(value) {
    this._value = convert(value) // 物件型別會用 reactive 包裹
    this.__v_isRef = true
  }

  get value() {
    track(this, 'value') // 收集 value 屬性的依賴
    return this._value
  }

  set value(newVal) {
    if (hasChanged(newVal, this._value)) {
      this._value = convert(newVal)
      trigger(this, 'value') // 觸發更新
    }
  }
}

// 使用
const count = ref(0)
console.log(count.value) // 0
count.value++

// 也可以包裹物件
const user = ref({ name: 'test' })
user.value.name = 'updated' // 這也會觸發響應式
```

## computed 的惰性求值

`computed` 返回一個帶有快取的 ref。只有依賴變化時才會重新計算。

```javascript
function computed(getter) {
  let value
  let dirty = true // 是否需要重新計算

  const effect = new ReactiveEffect(getter, () => {
    // 依賴變化時的 scheduler
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

console.log(doubled.value) // 2，首次計算
console.log(doubled.value) // 2，直接返回快取
count.value = 5
console.log(doubled.value) // 10，重新計算
```

## 小結

- Proxy 替代 defineProperty，解決新增/刪除屬性無響應式的問題
- 依賴收集用 WeakMap -> Map -> Set 三層結構，WeakMap 自動處理垃圾回收
- ref 本質是包了一層 `{ value }` 的 reactive
- computed 通過 dirty 標記實現惰性求值和快取
- 理解底層機制有助於排查響應式不生效的疑難雜症
