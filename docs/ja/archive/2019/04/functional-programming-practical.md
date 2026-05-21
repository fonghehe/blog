---
title: "JavaScriptの関数型プログラミング実践"
date: 2019-04-13 11:22:26
tags:
  - フロントエンド
readingTime: 1
description: "関数型プログラミングはフロントエンド界で常に注目されています——ReduxもRxJSもその影響を受けています。実際に役立つ概念をまとめました。"
wordCount: 151
---

関数型プログラミングはフロントエンド界で常に注目されています——ReduxもRxJSもその影響を受けています。実際に役立つ概念をまとめました。

## 純粋関数

```javascript
// 純粋関数：同じ入力は常に同じ出力、副作用なし
const add = (a, b) => a + b; // ✅ 純粋関数

// 純粋でない関数
let count = 0;
const increment = () => ++count; // ❌ 副作用あり

const getDate = () => new Date(); // ❌ 非決定的な結果
```

純粋関数のメリット：テスト可能、キャッシュ可能、並列実行可能。

## 高階関数

```javascript
// 関数を受け取るまたは返す関数
const map = (fn) => (arr) => arr.map(fn);
const filter = (fn) => (arr) => arr.filter(fn);
const reduce = (fn, init) => (arr) => arr.reduce(fn, init);

const double = (x) => x * 2;
const isEven = (x) => x % 2 === 0;

const numbers = [1, 2, 3, 4, 5];

// チェーン処理
const result = numbers
  .filter(isEven) // [2, 4]
  .map(double) // [4, 8]
  .reduce((acc, n) => acc + n, 0); // 12
```

## カリー化（Currying）

```javascript
// 複数引数の関数を単一引数の関数の連鎖に変換する
const curry = (fn) => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
};

const add = curry((a, b, c) => a + b + c);

add(1)(2)(3); // 6
add(1, 2)(3); // 6
add(1)(2, 3); // 6

// 実用例：部分適用の再利用
const addTax = add(0);
const fivePercentTax = addTax(0.05);

// mapと組み合わせた使用
const prices = [100, 200, 300];
const withTax = prices.map((price) => fivePercentTax(price));
```

## 関数合成

```javascript
// compose：右から左へ
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);

// pipe：左から右へ（より直感的）
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

const trim = (s) => s.trim();
const lower = (s) => s.toLowerCase();
const split = (s) => s.split(" ");

const processInput = pipe(trim, lower, split);
processInput("  Hello World  "); // ['hello', 'world']
```

## イミュータブルデータ

```javascript
// 直接変更せず、新しいオブジェクトを返す
const updateUser = (user, changes) => ({ ...user, ...changes });
const addItem = (list, item) => [...list, item];
const removeItem = (list, id) => list.filter((item) => item.id !== id);
```

これらのパターンにより、状態の変化が予測可能になりデバッグが容易になります。
