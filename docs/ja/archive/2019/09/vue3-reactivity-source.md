---
title: "Vue 3 Alphaソースコード：リアクティブシステムの内部"
date: 2019-09-24 15:06:04
tags:
  - Vue
readingTime: 2
description: "Vue 3 alpha のコードが公開されました！早速リアクティブシステム（packages/reactivity）を確認しましたが、Vue 2 と比較して大きく変わっていました。"
wordCount: 347
---

Vue 3 alpha のコードが公開されました。早速リアクティブシステム（packages/reactivity）を見てみましたが、Vue 2 と比べて大きく変わっていました。

## Vue 2 リアクティビティの限界

```javascript
// Vue 2 における Object.defineProperty
// 問題 1：新しいプロパティを検出できない
const vm = new Vue({ data: { user: { name: "Alice" } } });
vm.user.age = 25; // 更新をトリガーしない！ Vue.set(vm.user, 'age', 25) が必要

// 問題 2：配列のインデックス代入を検出できない
vm.items[0] = newItem; // 更新をトリガーしない！ Vue.set または splice が必要

// 問題 3：初期化時に全プロパティを走査する必要がある（パフォーマンス）
```

## Vue 3 の Proxy ベースのリアクティブ

```javascript
// packages/reactivity/src/reactive.ts（簡略版）

function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      // 依存関係の追跡
      track(target, TrackOpTypes.GET, key);

      const res = Reflect.get(target, key, receiver);

      // 遅延再帰：ネストされたオブジェクトにアクセスした時のみプロキシ
      if (isObject(res)) {
        return reactive(res);
      }

      return res;
    },

    set(target, key, value, receiver) {
      const hadKey = hasOwn(target, key);
      const result = Reflect.set(target, key, value, receiver);

      if (!hadKey) {
        // 新しいプロパティ：ADD タイプをトリガー
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        // プロパティの変更：SET タイプをトリガー
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

## effect、track、trigger

```javascript
// 現在アクティブな effect
let activeEffect = null;

// effect：リアクティブな副作用を定義
function effect(fn) {
  const effectFn = () => {
    activeEffect = effectFn;
    fn(); // 実行時に自動的に依存関係を追跡
    activeEffect = null;
  };
  effectFn(); // 即座に1回実行
  return effectFn;
}

// track：get で呼び出され、依存関係を収集
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

// trigger：set で呼び出され、更新をトリガー
function trigger(target, type, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const effects = depsMap.get(key) || new Set();
  effects.forEach((effect) => effect());
}
```

## refの実装

```javascript
// ref は基本型に使用（Proxy はオブジェクトしかプロキシできないため）
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

## computedの実装

```javascript
function computed(getter) {
  let dirty = true; // ダーティフラグ：true は再計算が必要であることを示す
  let value;

  const runner = effect(getter, {
    lazy: true, // 即座に実行しない
    scheduler: () => {
      dirty = true; // 依存関係の変更時にダーティとマークし、即座に再計算しない
    },
  });

  return {
    get value() {
      if (dirty) {
        value = runner(); // アクセス時にのみ計算
        dirty = false;
      }
      track(this, TrackOpTypes.GET, "value");
      return value;
    },
  };
}
```

## Vue 2とのパフォーマンス比較

|          | Vue 2                      | Vue 3                  |
| -------- | -------------------------- | ---------------------- |
| 初期化   | 全プロパティを再帰的に走査 | 遅延プロキシ（アクセス時にのみプロキシ） |
| 新しいプロパティ | 追跡しない（$set が必要）  | 自動追跡               |
| 配列     | 7つのメソッドを書き換え     | ネイティブ対応          |
| メモリ   | プロパティごとに getter/setter を作成 | WeakMap で依存関係を管理 |

## まとめ

- Proxy は defineProperty より強力：追加、削除、配列インデックス操作をインターセプト可能
- 遅延再帰プロキシ（アクセス時に reactive）は Vue 2 の初期化時の全量再帰より効率的
- `track` が依存関係を収集し、`trigger` が更新をトリガーする、これがリアクティブシステムの中核
- `computed` はダーティフラグで遅延評価を実現し、アクセス時にのみ再計算する
