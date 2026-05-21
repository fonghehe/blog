---
title: "Vue 2ソースコードを読む：リアクティブシステムの原理"
date: 2018-06-05 10:32:51
tags:
  - Vue
readingTime: 3
description: "Vueのリアクティブシステムはその最も核心的な機能で、多くの面接問題がこれを中心に展開されます。この記事ではVue 2.xのソースコードを読み、実装原理を明らかにします。"
wordCount: 537
---

Vueのリアクティブシステムはその最も核心的な機能で、多くの面接問題がこれを中心に展開されます。この記事ではVue 2.xのソースコードを読み、実装原理を明らかにします。

## コア：Object.defineProperty

Vue 2のリアクティブは`Object.defineProperty`をベースにし、データの各プロパティにgetter/setterを設定します：

```javascript
function defineReactive(obj, key, value) {
  const dep = new Dep(); // 依存収集器

  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (Dep.target) {
        // 現在計算中のWatcherがある
        dep.depend(); // 依存を収集
      }
      return value;
    },
    set(newValue) {
      if (newValue === value) return;
      value = newValue;
      dep.notify(); // すべてのWatcherに更新を通知
    },
  });
}
```

## Observer：オブジェクト全体を再帰的に処理する

```javascript
class Observer {
  constructor(value) {
    this.value = value;

    if (Array.isArray(value)) {
      // 配列の特別処理
      this.observeArray(value);
    } else {
      this.walk(value);
    }
  }

  walk(obj) {
    Object.keys(obj).forEach((key) => {
      defineReactive(obj, key, obj[key]);
    });
  }

  observeArray(arr) {
    arr.forEach((item) => observe(item));
  }
}

function observe(value) {
  if (typeof value !== "object") return;
  return new Observer(value);
}
```

## Dep：依存管理

各リアクティブプロパティは`Dep`インスタンスを持ち、そのプロパティに依存するすべての`Watcher`を管理します：

```javascript
class Dep {
  constructor() {
    this.subscribers = new Set();
  }

  depend() {
    if (Dep.target) {
      this.subscribers.add(Dep.target);
    }
  }

  notify() {
    this.subscribers.forEach((watcher) => watcher.update());
  }
}

Dep.target = null; // 現在計算中のWatcher
```

## Watcher：オブザーバー

各算出プロパティ、watchオプション、レンダリング関数はそれぞれ1つの`Watcher`に対応します：

```javascript
class Watcher {
  constructor(vm, expOrFn, callback) {
    this.vm = vm;
    this.cb = callback;
    this.getter = typeof expOrFn === "function" ? expOrFn : () => vm[expOrFn];

    this.value = this.get(); // 初期化時にgetterを発火させて依存収集を完了
  }

  get() {
    Dep.target = this; // 現在のWatcherを設定
    const value = this.getter.call(this.vm); // データのgetterを発火
    Dep.target = null; // クリア
    return value;
  }

  update() {
    const oldValue = this.value;
    this.value = this.get();
    this.cb.call(this.vm, this.value, oldValue);
  }
}
```

## 全体的なフロー

```
data: { count: 0 }
   ↓ Vue.observe()
countプロパティがdefinePropertyされ、Depが作成される

コンポーネントのレンダリング関数が実行される
   ↓ this.countにアクセス
countのgetterが発火する
   ↓ Dep.target = レンダリングWatcher
dep.depend() → レンダリングWatcherがdep.subscribersに追加される

this.count++
   ↓ countのsetterが発火する
dep.notify() → すべてのsubscribersに通知
   ↓ レンダリングWatcher.update()
コンポーネントが再レンダリングされる
```

## Vue 2リアクティブの制限

原理を理解すると、なぜこれらの制限があるのかが分かります：

### プロパティの追加・削除を検知できない

```javascript
// ❌ この追加はリアクティブではない
this.user.age = 18; // definePropertyされていないので更新はトリガーされない

// ✅ Vue.setを使う
this.$set(this.user, "age", 18);
```

理由：`defineProperty`は既存のプロパティしかインターセプトできず、新しく追加されたプロパティはインターセプトできません。

### 配列のインデックス代入を検知できない

```javascript
// ❌ 更新はトリガーされない
this.list[0] = "new value";
this.list.length = 0;

// ✅ 配列メソッドを使う
this.list.splice(0, 1, "new value");
this.list.splice(0);

// ✅ または配列全体を置き換える
this.list = [...this.list];
```

Vueはpush/pop/spliceなどの配列メソッドをインターセプトし、これらのメソッドは更新をトリガーします。

## Vue 2とVue 3のリアクティブの比較

Vue 3では`Object.defineProperty`の代わりに`Proxy`を使用し、上記の制限を解決しました：

```javascript
// Proxyはプロパティの追加・削除をインターセプトできる
const proxy = new Proxy(obj, {
  set(target, key, value) {
    const oldValue = target[key];
    target[key] = value;
    trigger(target, key); // 更新をトリガー
    return true;
  },
});

proxy.newProp = "value"; // 検知できるようになった！
```

## まとめ

- Vue 2のリアクティブは`Object.defineProperty` + Dep/Watcherパターンをベースにしている
- Observerはオブジェクトプロパティを再帰的に処理し、Depは依存を管理し、Watcherは変化に応答する
- `Object.defineProperty`の制限によりプロパティの追加・削除を検知できない
- Vue 3ではProxyを使ってこれらの制限を解決した
