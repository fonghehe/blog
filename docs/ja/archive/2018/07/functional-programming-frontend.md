---
title: "デバウンス・スロットル以外：関数型プログラミングの思想をフロントエンドに活かす"
date: 2018-07-03 10:12:42
tags:
  - フロントエンド
readingTime: 3
description: "最近関数型プログラミングの資料を読んでいると、多くの考え方がフロントエンド開発でもすでに使われていることに気づきました。ただ明確に意識していなかっただけです。実際に価値のある部分をまとめます。"
wordCount: 592
---

最近関数型プログラミングの資料を読んでいると、多くの考え方がフロントエンド開発でもすでに使われていることに気づきました。ただ明確に意識していなかっただけです。実際に価値のある部分をまとめます。

## 純粋関数：予測可能な関数

純粋関数には2つの特性があります：

1. 同じ入力は常に同じ出力を返す
2. 副作用がない（外部の状態を変更しない）

```javascript
// ❌ 純粋関数ではない：結果が外部変数に依存している
let discount = 0.9;
function getPrice(price) {
  return price * discount; // discountが変わると結果も変わる
}

// ✅ 純粋関数
function getPrice(price, discount) {
  return price * discount; // 同じ入力は常に同じ出力
}
```

純粋関数の利点：

- テストが容易（外部状態をモックする必要がない）
- キャッシュが容易（同じ入力 = 同じ出力なのでメモ化できる）
- 推論が容易（副作用を心配しなくていい）

## 関数合成

小さな関数を組み合わせて複雑なデータ処理パイプラインを作る：

```javascript
// 元の書き方：ネストした呼び出し
const result = sanitize(trim(toLowerCase(input)));

// 関数合成
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

const processInput = pipe(toLowerCase, trim, sanitize);

const result = processInput(input); // 左から右に実行
```

実際の活用例：

```javascript
// データ処理パイプライン
const processUsers = pipe(
  (users) => users.filter((u) => u.isActive),
  (users) => users.map((u) => ({ ...u, name: u.name.trim() })),
  (users) => users.sort((a, b) => a.name.localeCompare(b.name)),
);

const activeUsers = processUsers(rawUsers);
```

## カリー化（Currying）

複数引数の関数を単引数の関数の列に変換する：

```javascript
// 通常の関数
function add(a, b) {
  return a + b;
}

// カリー化
function curriedAdd(a) {
  return function (b) {
    return a + b;
  };
}

// アロー関数の簡略表記
const curriedAdd = (a) => (b) => a + b;

const add5 = curriedAdd(5); // 第1引数を固定
add5(3); // 8
add5(10); // 15
```

実際の活用：

```javascript
// パラメーター化されたバリデーション関数
const minLength = (min) => (str) => str.length >= min;
const maxLength = (max) => (str) => str.length <= max;
const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const validators = {
  username: [minLength(3), maxLength(20)],
  email: [isEmail],
  password: [minLength(8)],
};

function validate(value, rules) {
  return rules.every((rule) => rule(value));
}

validate("alice", validators.username); // true
validate("ab", validators.username); // false（短すぎる）
```

## イミュータブルデータ

データを直接変更せず、新しいデータを作成する：

```javascript
// ❌ 直接変更
function updateUser(user, newName) {
  user.name = newName; // 元のオブジェクトを変更してしまう
  return user;
}

// ✅ 新しいオブジェクトを作成
function updateUser(user, newName) {
  return { ...user, name: newName };
}

// 配列操作
// ❌ 直接変更
list.push(newItem);
list.splice(index, 1);

// ✅ イミュータブルな操作
const newList = [...list, newItem];
const filteredList = list.filter((_, i) => i !== index);
```

イミュータブルデータの利点：

- 変化を追跡しやすい（古い値と新しい値の両方が存在し比較できる）
- Vue/Reactの変化検出がより信頼できる
- タイムトラベルデバッグ（Redux DevTools）が可能になる

## Vueでの活用

```javascript
// 算出プロパティ（純粋関数）
computed: {
  filteredList() {
    // this.listを変更せず、新しい配列を返す
    return this.list
      .filter(item => item.status === this.filterStatus)
      .map(item => ({ ...item, label: item.name.toUpperCase() }))
  }
}
```

```javascript
// Vuexのmutation——イミュータビリティを維持する
mutations: {
  UPDATE_USER(state, payload) {
    // ✅ スプレッド演算子で新しいオブジェクトを作成
    state.users = state.users.map(user =>
      user.id === payload.id
        ? { ...user, ...payload.changes }
        : user
    )
  }
}
```

## まとめ

関数型の考え方はすべてを取り入れる必要はありません。実用的な部分は：

- **純粋関数**：ユーティリティ関数はできるだけ純粋関数として書く。テストが楽になる
- **イミュータブルデータ**：状態管理でイミュータビリティの原則に従う
- **関数合成**：複雑なデータ処理には`pipe`を使って整理する。ネストした呼び出しより明快
- 「関数型の純粋さ」を追求する必要はない。命令型との混合で完全に問題ない
