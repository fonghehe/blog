---
title: "JavaScript ディープクローンの各アプローチ"
date: 2018-03-17 11:08:16
tags:
  - JavaScript
readingTime: 3
description: "ディープクローンはフロントエンドでよく必要になりますが、実装には多くの落とし穴があります。各アプローチの適用シナリオと制限をまとめます。"
---

ディープクローンはフロントエンドでよく必要になりますが、実装には多くの落とし穴があります。各アプローチの適用シナリオと制限をまとめます。

## シャロークローン vs ディープクローン

```javascript
const obj = { name: "Alice", address: { city: "東京" } };

// シャロークローン：第 1 層のみコピー、ネストされた参照は同じ
const shallow = { ...obj };
shallow.address.city = "大阪";
console.log(obj.address.city); // '大阪' — 元のオブジェクトが変更された！

// ディープクローン：完全に独立、変更は元のオブジェクトに影響しない
const deep = deepClone(obj);
deep.address.city = "大阪";
console.log(obj.address.city); // '東京' — 元のオブジェクトは影響を受けない
```

## アプローチ 1：JSON シリアライゼーション

```javascript
const clone = JSON.parse(JSON.stringify(obj));
```

**メリット**：シンプル、1 行のコード

**デメリット**：

- `undefined`、関数、Symbol を処理できない（失われる）
- 循環参照を処理できない（エラーをスロー）
- `Date` オブジェクトが文字列になる
- `NaN`、`Infinity` が `null` になる
- `RegExp` は保持されない

```javascript
const obj = {
  undef: undefined, // 失われる
  fn: () => {}, // 失われる
  date: new Date(), // 文字列 "2018-03-17T..." になる
  regex: /test/g, // 空オブジェクト {} になる
  nan: NaN, // null になる
};

const clone = JSON.parse(JSON.stringify(obj));
// { date: "2018-03-17T...", nan: null }
```

**適した用途**：純粋なデータオブジェクト（特殊な型なし）、素早い一時的な使用。

## アプローチ 2：再帰実装

```javascript
function deepClone(source, cache = new WeakMap()) {
  // プリミティブ型はそのまま返す
  if (source === null || typeof source !== "object") return source;

  // 循環参照を処理
  if (cache.has(source)) return cache.get(source);

  // 特殊な型を処理
  if (source instanceof Date) return new Date(source.getTime());
  if (source instanceof RegExp) return new RegExp(source.source, source.flags);

  // 空のオブジェクト/配列を作成
  const target = Array.isArray(source) ? [] : {};
  cache.set(source, target);

  // 各プロパティを再帰的にコピー
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = deepClone(source[key], cache);
    }
  }

  return target;
}
```

テスト：

```javascript
const original = {
  name: "Alice",
  address: { city: "東京" },
  hobbies: ["coding", "reading"],
  date: new Date(),
  regex: /test/g,
};

// 循環参照テスト
original.self = original;

const cloned = deepClone(original);
cloned.address.city = "大阪";

console.log(original.address.city); // '東京' — 影響を受けない
console.log(cloned.self === cloned); // true — 循環参照が正しく処理された
console.log(cloned.date instanceof Date); // true
```

## アプローチ 3：structuredClone（モダンブラウザ）

2022 年から各ブラウザでネイティブサポート。2018 年時点では利用不可ですが、知っておく価値があります：

```javascript
// 将来利用可能（Chrome 98+、Firefox 94+、Node 17+）
const clone = structuredClone(obj);
```

ほとんどの型をサポートしますが、関数と Symbol はサポートしません。

## アプローチ 4：lodash.cloneDeep

本番環境で最も信頼できるアプローチ：

```javascript
import cloneDeep from "lodash/cloneDeep";

const clone = cloneDeep(source);
```

lodash の実装はあらゆるエッジケースを処理しており、最も堅牢な選択です。

## 実際のプロジェクトでの選び方

| シナリオ                             | 推奨                           |
| ------------------------------------ | ------------------------------ |
| 純粋なデータオブジェクト、素早い使用 | `JSON.parse(JSON.stringify())` |
| Date/RegExp の処理が必要             | lodash `cloneDeep`             |
| 依存関係なし、データ構造が既知       | 自分で再帰実装を書く           |
| フォームのリセット、初期値の保存     | lodash `cloneDeep`             |

```javascript
// フォームシナリオ：リセット用に初期値を保存
import cloneDeep from 'lodash/cloneDeep'

data() {
  return {
    form: { name: '', email: '' },
    originalForm: null
  }
},
created() {
  this.loadData()
},
methods: {
  async loadData() {
    const data = await fetchFormData()
    this.form = data
    this.originalForm = cloneDeep(data)  // 初期状態を保存
  },
  handleReset() {
    this.form = cloneDeep(this.originalForm)  // 復元
  }
}
```

## まとめ

- シンプルなケースでは `JSON.parse(JSON.stringify())` を使うが、制限を理解しておく
- 本番コードでは `lodash/cloneDeep` を推奨 — 安心
- 依存関係ゼロが必要な場合は再帰実装を書き、循環参照の処理を忘れずに
