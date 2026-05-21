---
title: "JavaScriptのSymbol：実践的なユースケース"
date: 2018-08-28 15:30:12
tags:
  - JavaScript
readingTime: 2
description: "SymbolはES6で追加されたプリミティブ型ですが、いつ使えばいいか分からない人が多いです。いくつかの実践的なシナリオを紹介します。"
wordCount: 384
---

SymbolはES6で追加されたプリミティブ型ですが、いつ使えばいいか分からない人が多いです。いくつかの実践的なシナリオを紹介します。

## 核心的な特性：唯一性

```javascript
const s1 = Symbol("description");
const s2 = Symbol("description");

console.log(s1 === s2); // false！同じ説明でも、異なるSymbolです
console.log(typeof s1); // 'symbol'
```

## ユースケース1：オブジェクトのプロパティ名の衝突を避ける

外部オブジェクト（自分が所有していないオブジェクト）にプロパティを追加する際、Symbolを使うことで既存プロパティとの衝突を避けられます：

```javascript
// Arrayにカスタムメソッドを追加（プロトタイプを汚染しない）
const customId = Symbol("customId");
const arr = [1, 2, 3];
arr[customId] = "my-array";

// 配列のlength、pushなどのプロパティと衝突しない
console.log(arr[customId]); // 'my-array'
console.log(Object.keys(arr)); // ['0', '1', '2']  Symbolプロパティはここに現れない
```

## ユースケース2：列挙値（マジックストリングの防止）

```javascript
// Symbolを使わない場合：文字列を使用
const STATUS = {
  PENDING: "pending",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
};
// 問題：'pending'が他の場所の文字列と意図せず一致する可能性がある

// Symbolを使う場合：各値は唯一
const STATUS = {
  PENDING: Symbol("pending"),
  LOADING: Symbol("loading"),
  SUCCESS: Symbol("success"),
  ERROR: Symbol("error"),
};

let state = STATUS.PENDING;
if (state === STATUS.PENDING) {
  /* 本当のPENDINGのみマッチ */
}
```

## ユースケース3：内部プロパティ、外部アクセスの防止

```javascript
const _private = Symbol("private");

class MyClass {
  constructor() {
    this[_private] = "secret"; // 「プライベート」プロパティ（アクセスは可能だが、偶然には見つからない）
    this.public = "public";
  }

  getPrivate() {
    return this[_private];
  }
}

const obj = new MyClass();
console.log(obj.public); // 'public'
console.log(obj[_private]); // 'secret'（_privateのSymbolにアクセスできれば）
console.log(Object.keys(obj)); // ['public']（Symbolはここに現れない）
```

## Well-known Symbol（組み込みSymbol）

JSエンジンはSymbolを使って多くの動作を内部的に定義しています。それらをオーバーライドすることでオブジェクトの動作をカスタマイズできます：

```javascript
// Symbol.iterator：オブジェクトをイテラブルにする
class Range {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const end = this.end;
    return {
      next() {
        if (current <= end) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}

const range = new Range(1, 5);
console.log([...range]); // [1, 2, 3, 4, 5]
for (const n of range) {
  console.log(n);
}
```

```javascript
// Symbol.toPrimitive：型変換のカスタマイズ
class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }

  [Symbol.toPrimitive](hint) {
    if (hint === "number") return this.amount;
    if (hint === "string") return `${this.amount} ${this.currency}`;
    return this.amount; // default
  }
}

const price = new Money(100, "JPY");
console.log(`価格：${price}`); // '価格：100 JPY'
console.log(price + 50); // 150
console.log(price > 80); // true
```

## Symbol.for：グローバル共有Symbol

```javascript
// Symbol()：毎回新しいSymbolを作成
Symbol("key") !== Symbol("key");

// Symbol.for()：同じキーに対して同じSymbolを返す（グローバルレジストリ）
Symbol.for("key") === Symbol.for("key"); // true

// 用途：モジュール間で同じSymbolを共有
// moduleA.js
const MY_KEY = Symbol.for("app:my-key");

// moduleB.js
const MY_KEY = Symbol.for("app:my-key"); // moduleAと同じSymbol
```

## まとめ

- Symbolの核心：唯一で不変
- ユースケース：プロパティ名の衝突回避、唯一の列挙値、「プライベート」プロパティ
- Well-known Symbol：`Symbol.iterator`、`Symbol.toPrimitive`などでオブジェクトの動作をカスタマイズ可能
- `Symbol.for`：グローバル登録、モジュール間での共有
- Symbolプロパティは`for...in`や`Object.keys()`には現れないが、`Reflect.ownKeys()`で取得可能
