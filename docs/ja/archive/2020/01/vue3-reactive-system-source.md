---
title: "Vue 3 リアクティブシステムのソースコード解析"
date: 2020-01-03 16:10:29
tags:
  - Vue
readingTime: 3
description: "Vue 3 的响应式系统基于 ES6 Proxy 重写，彻底告别了 Vue 2 的 `Object.defineProperty` 方案。理解其源码实现，不仅能帮助我们写出更高效的代码，还能避免一些隐蔽的性能陷阱。"
wordCount: 510
---

Vue 3 のリアクティブシステムは ES6 の Proxy で書き直され、Vue 2 の `Object.defineProperty` 方式は完全に過去のものになった。そのソース実装を理解すれば、より効率的なコードを書けるだけでなく、いくつかの目に見えないパフォーマンスの落とし穴も避けられる。

## ProxyとReflectの連携

Vue 3 は `Proxy` を使ってオブジェクトの読み書きをフックし、`Reflect` と組み合わせて `this` の向きを正しく保つ。

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

Vue 2 の `Object.defineProperty` と異なり、Proxy はプロパティの追加や削除もフックでき、`Vue.set` や `Vue.delete` は不要だ。

## 依存収集のMap構造

リアクティブシステムは3階層の Map 構造で依存関係を保持する：`targetMap -> depsMap -> dep`。

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

`WeakMap` により、`target` がガベージコレクションされたときに対応する依存情報も自動的に消去され、メモリリークを防ぐ。

## refとreactiveの違い

`ref` は本質的に基本型へのラッパーで、内部では `reactive` で `{ value: ... }` オブジェクトを包んでいる。

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

## computed の遅延評価

`computed` はキャッシュ付きの ref を返す。依存が変化したときだけ再計算される。

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

## まとめ

- Proxy が defineProperty に代わり、プロパティの追加／削除がリアクティブにならない問題を解決する
- 依存収集は WeakMap -> Map -> Set の3階層構造で、WeakMap がガベージコレクションを自動処理する
- ref は本質的に `{ value }` を1層包んだ reactive だ
- computed は dirty フラグで遅延評価とキャッシュを実現する
- 背後にある仕組みを理解すれば、リアクティブが効かない難解な不具合の切り分けに役立つ
