---
title: "Vue 3 Alphaプレビュー：Proxyベースのリアクティビティ"
date: 2019-08-14 16:33:13
tags:
  - Vue
readingTime: 5
description: "2019 年、Vue チームは Vue 3 の Alpha バージョンをリリースしました。最大の変更点の一つは、リアクティブシステムが Object.defineProperty から ES6 の Proxy に切り替わったことです。この記事ではソースコードと実践の両方の観点から、Vue 2 と Vue 3 のリアクティブ実装の違いを比較し、Vue 3 の新機能を先取りして紹介します。"
wordCount: 900
---

2019 年、Vue チームは Vue 3 の Alpha バージョンをリリースしました。最大の変更点の一つは、リアクティブシステムが `Object.defineProperty` から ES6 の `Proxy` に切り替わったことです。この記事ではソースコードと実践の両方の観点から、Vue 2 と Vue 3 のリアクティブ実装の違いを比較し、Vue 3 の新機能を先取りして紹介します。

## Vue 2 リアクティビティの限界

Vue 2 は `Object.defineProperty` を使用してオブジェクトのプロパティの読み書きをインターセプトします。この方式にはいくつかの明確な欠点があります：

### 1. プロパティの追加と削除を検出できない

```js
// Vue 2
const vm = new Vue({
  data() {
    return {
      user: { name: '张三' }
    };
  },
  methods: {
    addAge() {
      // この操作は Vue 2 では検出できません！
      this.user.age = 25;
      // Vue.set を使用してリアクティブ更新をトリガーする必要があります
      this.$set(this.user, 'age', 25);
    }
  }
});
```

### 2. 配列インデックスの変更を検出できない

```js
// Vue 2
const vm = new Vue({
  data() {
    return {
      list: [1, 2, 3]
    };
  },
  methods: {
    updateFirst() {
      // ビューの更新をトリガーしません
      this.list[0] = 100;
      // splice を使用する必要があります
      this.$set(this.list, 0, 100);
    }
  }
});
```

### 3. 初期化時にすべてのプロパティを再帰的にトラバースする必要がある

Vue 2 はリアクティブオブジェクトを作成する際、すべてのプロパティを再帰的にトラバースし、getter/setter に変換します。大規模なオブジェクトの場合、この処理にはパフォーマンスのオーバーヘッドが発生します。

## Vue 3 Proxyによるリアクティビティの実装

Vue 3 は `Proxy` を使用してオブジェクト全体をプロキシし、上記の問題を根本的に解決しました。

### 基本原則

```js
// 簡略化した Vue 3 リアクティブシステム
let activeEffect = null;

function reactive(target) {
  const handler = {
    get(target, key, receiver) {
      // 依存関係を収集
      if (activeEffect) {
        track(target, key);
      }
      const result = Reflect.get(target, key, receiver);
      // ディーププロキシ：アクセスされたプロパティのみがプロキシされます（遅延）
      if (typeof result === 'object' && result !== null) {
        return reactive(result);
      }
      return result;
    },

    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      // 値が実際に変更された場合のみ更新をトリガー
      if (oldValue !== value) {
        trigger(target, key);
      }
      return result;
    },

    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);
      // プロパティの削除でも更新をトリガー
      if (hadKey && result) {
        trigger(target, key);
      }
      return result;
    },

    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },

    ownKeys(target) {
      track(target, 'iterate');
      return Reflect.ownKeys(target);
    }
  };

  return new Proxy(target, handler);
}

// 依存関係の保存
const targetMap = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach(effect => effect());
  }
}

function effect(fn) {
  activeEffect = fn;
  fn(); // 一度実行して依存関係を収集
  activeEffect = null;
}
```

### 使用例

```js
const state = reactive({
  count: 0,
  user: {
    name: '张三',
    hobbies: ['coding', 'reading'],
  },
});

// 自動的に依存関係を収集
effect(() => {
  console.log(`count: ${state.count}`);
});

effect(() => {
  console.log(`用户: ${state.user.name}`);
});

state.count = 1;          // 出力: count: 1
state.user.name = '李四'; // 出力: ユーザー: 李四

// 動的にプロパティを追加 —— 自動的にリアクティブに
state.user.age = 25; // これは Vue 3 で完全に動作します！

// プロパティの削除 —— 自動的に更新をトリガー
delete state.user.age; // 正しく更新をトリガーできます

// 配列操作 —— インデックスで直接変更
state.user.hobbies[0] = 'gaming'; // 完全にサポートされています！
```

## Vue 3 Composition APIとリアクティビティ

Vue 3 は `reactive`、`ref`、`computed`、`watch` などの関数型 API を提供します：

```js
import { reactive, ref, computed, watch, toRefs } from 'vue';

// reactive はオブジェクト型に使用
const state = reactive({
  firstName: '张',
  lastName: '三',
  age: 25,
});

// computed 算出プロパティ
const fullName = computed(() => {
  return `${state.firstName}${state.lastName}`;
});

// ref はプリミティブ型に使用
const count = ref(0);

// watch で変更を監視
watch(
  () => state.age,
  (newVal, oldVal) => {
    console.log(`年龄从 ${oldVal} 变为 ${newVal}`);
  }
);

// テンプレートで使用
state.age = 26; // 触发 watch 和视图更新
count.value++;  // ref は .value でアクセスする必要がある
```

## Proxy vs defineProperty 比較

| 特徴 | defineProperty | Proxy |
|------|---------------|-------|
| プロパティの追加/削除 | 検出不可 | 自動検出 |
| 配列インデックスの変更 | 検出不可 | 自動検出 |
| 深いネスト | 初期化時にすべて再帰 | 遅延プロキシ、必要に応じて処理 |
| Map/Set | 非サポート | 拡張可能 |
| パフォーマンス | 初期化が遅い | 初期化が速く、オンデマンドでプロキシ |
| 互換性 | IE9+ | IE 非サポート |

## refとreactiveの使い分け

```js
import { ref, reactive } from 'vue';

// ref: プリミティブ型や全体を置き換えるデータに適している
const count = ref(0);
const list = ref([]);
const name = ref('张三');

// reactive: オブジェクト型に適している
const user = reactive({
  name: '张三',
  age: 25,
});

// テンプレートでは ref は自動的にアンラップされるため .value は不要
// ただし JS では .value を使用する必要がある
count.value++;
console.log(count.value); // 2

// 実際のプロジェクトでのベストプラクティス
function useUser() {
  const user = reactive({
    name: '',
    email: '',
    age: 0,
  });

  const isValid = computed(() => {
    return user.name.length > 0 && user.email.includes('@');
  });

  function reset() {
    user.name = '';
    user.email = '';
    user.age = 0;
  }

  return {
    ...toRefs(user), // reactive オブジェクトを ref のセットに変換し、分割代入を容易にする
    isValid,
    reset,
  };
}

// コンポーネント内で使用
const { name, email, age, isValid, reset } = useUser();
```

## 分割代入によるリアクティビティ喪失をtoRefsで解決

```js
import { reactive, toRefs } from 'vue';

function useCounter() {
  const state = reactive({
    count: 0,
    doubled: computed(() => state.count * 2),
  });

  const increment = () => state.count++;
  const decrement = () => state.count--;

  // 直接分割代入するとリアクティビティが失われる
  // return { count: state.count, increment }; // 错误！

  // toRefs を使用してリアクティビティを維持
  return {
    ...toRefs(state),
    increment,
    decrement,
  };
}

// 使用時は安全に分割代入可能
const { count, doubled, increment } = useCounter();
// count と doubled はどちらも ref であり、リアクティビティを維持
```

## まとめ

- Vue 3 は `Proxy` を使用して `Object.defineProperty` を置き換え、Vue 2 のリアクティブの限界を根本的に解決しました
- Proxy はプロパティの追加、削除、配列インデックスの変更などの操作をインターセプトでき、特別な API は不要です
- 遅延プロキシメカニズム：アクセスされた深いプロパティのみがプロキシされるため、初期化のパフォーマンスが向上します
- Composition API（`reactive`、`ref`、`computed`、`watch`）はより柔軟なロジック編成方法を提供します
- `ref` はプリミティブ型に、`reactive` はオブジェクト型に使用し、`toRefs` は分割代入によるリアクティビティの喪失を解決します
- Proxy は IE をサポートしておらず、Vue 3 は正式に IE11 以下のサポートを終了しました
- Vue 3 の Alpha 段階では API が調整される可能性がありますが、コアとなる設計理念は確定しています
