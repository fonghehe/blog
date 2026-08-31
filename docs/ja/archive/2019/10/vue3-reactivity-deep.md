---
title: "Vue 3リアクティビティの深掘り：definePropertyからProxyへ"
date: 2019-10-23 17:10:53
tags:
  - Vue
readingTime: 2
description: "Vue 3 将响应式系统从 `Object.defineProperty` 完全重写为 `Proxy`。这不是为了追时髦，而是为了彻底解决 Vue 2 中一些根本性缺陷。"
wordCount: 332
---

Vue 3 はレスポンシブシステムを `Object.defineProperty` から `Proxy` へと完全に書き直しました。これは流行りに乗るためではなく、Vue 2 のいくつかの根本的な欠陥を徹底的に解決するためです。

## Vue 2 の限界

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

`Object.defineProperty` はオブジェクト作成時にプロパティを走査して getter/setter を追加するため、後から追加されたプロパティは当然ながら捕捉されません。

## Vue 3 の Proxyアプローチ

`Proxy` はオブジェクトのすべての操作を捕捉でき、プロパティの追加や削除も含みます：

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

## trackとtriggerの原理

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

## シンプルな使用例

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

## refによるプリミティブ型のラッピング

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

## まとめ

Vue 3 のレスポンシブシステムの刷新は、単なる技術選択のイテレーションではなく、元の設計上の限界に対する徹底的な修正です。`Proxy` の全操作捕捉能力と `WeakMap` でインデックスされた依存関係グラフの組み合わせは、性能と正確性の両面で優れていることが実証されています。
