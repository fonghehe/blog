---
title: "JavaScript BigInt：大きな整数の扱い"
date: 2019-09-11 15:50:18
tags:
  - JavaScript
readingTime: 4
description: "JavaScript の Number 型は IEEE 754 倍精度浮動小数点数に基づいており、安全な整数範囲は -(2^53 - 1) から 2^53 - 1（すなわち Number.MAX_SAFE_INTEGER と Number.MIN_SAFE_INTEGER）です。この範囲を超える整数演算では精度が失われます。ES2020 で導入された BigInt は、任意の精度で整数を表現できる新しいプリミティブ型です。"
wordCount: 596
---

JavaScript の `Number` 型は IEEE 754 倍精度浮動小数点数に基づいており、安全な整数範囲は `-(2^53 - 1)` から `2^53 - 1`（すなわち `Number.MAX_SAFE_INTEGER` と `Number.MIN_SAFE_INTEGER`）です。この範囲を超える整数演算では精度が失われます。ES2020 で導入された `BigInt` 型は、任意の精度で整数を表現できる新しいプリミティブ型です。この記事では BigInt の使用シナリオ、構文、注意点について詳しく解説します。

## Number精度問題のデモ

```js
// Number.MAX_SAFE_INTEGER = 9007199254740991
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991

// 安全な整数範囲を超える
console.log(9007199254740991 + 1); // 9007199254740992 (正确)
console.log(9007199254740991 + 2); // 9007199254740992 (错误！应该是 9007199254740993)

// 実際の業務における精度問題
const userId = 123456789012345678;
console.log(userId); // 123456789012345680 (最后两位变了！)

// データベースの 64 ビット ID がフロントエンドに渡されると精度が失われる
const orderId = '201908010000000001';
console.log(Number(orderId)); // 201908010000000000 (最后一位变成了0)
```

## BigIntの基本的な使い方

```js
// BigInt を作成する 2 つの方法
const a = 9007199254740993n;                    // リテラル方式：数値の後に n を付ける
const b = BigInt('9007199254740993');           // コンストラクタ方式

// 数値から作成
const c = BigInt(9007199254740993);             // 非推奨、精度が失われる可能性がある
const d = BigInt('9007199254740993');           // 推奨、文字列から作成

// 基本演算
console.log(10n + 20n);    // 30n
console.log(10n - 20n);    // -10n
console.log(10n * 20n);    // 200n
console.log(10n / 3n);     // 3n (整数除算、小数部は切り捨て)
console.log(10n % 3n);     // 1n
console.log(10n ** 3n);    // 1000n

// 比較演算
console.log(10n > 5n);     // true
console.log(10n === 10);   // false (型が異なる)
console.log(10n == 10);    // true (緩やかな等価性)
console.log(10n < 11);     // true

// 単項演算子
console.log(-10n);         // -10n
console.log(+10n);         // TypeError: Cannot convert a BigInt value to a number
```

## BigIntとNumberは混在できない

BigInt と Number は直接混合演算できません。先に型を変換する必要があります：

```js
// エラー：混在演算は不可
// 10n + 10; // TypeError: Cannot mix BigInt and other types

// 正しい：変換後に計算
const result1 = 10n + BigInt(10);   // 20n
const result2 = Number(10n) + 10;   // 20
const result3 = 10n + BigInt('10'); // 20n

// 条件分岐で型を選択
function safeAdd(a, b) {
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    return BigInt(a) + BigInt(b);
  }
  return a + b;
}
```

## 実践：データベースIDの処理

```js
// バックエンドから返されるユーザー ID（64 ビット整数）
const userId = '1234567890123456789';

// BigInt に変換して処理
const id = BigInt(userId);

// ID の比較
function compareId(id1, id2) {
  return BigInt(id1) === BigInt(id2);
}

// ID 演算（子 ID の生成など）
function generateChildId(parentId, index) {
  const parent = BigInt(parentId);
  const offset = BigInt(index);
  return (parent << 8n) | offset; // ビット演算
}

// JSON にシリアライズ
function toJson(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

// デシリアライズ
function fromJson(json) {
  return JSON.parse(json, (key, value) => {
    // 数字の文字列を BigInt に変換してみる
    if (typeof value === 'string' && /^\d{16,}$/.test(value)) {
      return BigInt(value);
    }
    return value;
  });
}

const user = {
  id: 1234567890123456789n,
  name: '张三',
};

console.log(toJson(user));
// {"id":"1234567890123456789","name":"张三"}
```

## 実践：正確な金額計算

金融シーンでは、金額は通常、最小単位（例：銭）で整数として格納されます：

```js
// 金額計算（銭単位）
const price1 = 9999n;       // 99.99 円
const price2 = 8888n;       // 88.88 円
const discount = 100n;      // 1.00 円割引

const total = price1 + price2 - discount; // 18787 銭 = 187.87 円

// 円にフォーマット
function formatCurrency(cents) {
  const str = cents.toString();
  const yuan = str.slice(0, -2) || '0';
  const jiao = str.slice(-2).padStart(2, '0');
  return `${yuan}.${jiao}`;
}

console.log(formatCurrency(total)); // "187.87"

// パーセンテージ割引
function applyDiscount(price, percentOff) {
  // percentOff: 割引パーセンテージ（例：85 は 85% オフ）
  return (price * BigInt(percentOff)) / 100n;
}

const salePrice = applyDiscount(10000n, 85); // 8500n = 85.00 円
console.log(formatCurrency(salePrice)); // "85.00"
```

BigInt はすべての整数ビット演算をサポートしています：

```js
const a = 0b1010n;  // 10
const b = 0b1100n;  // 12

console.log(a & b);   // 0b1000n = 8  (AND)
console.log(a | b);   // 0b1110n = 14 (OR)
console.log(a ^ b);   // 0b0110n = 6  (XOR)
console.log(~a);      // -11n         (NOT)

console.log(a << 2n);  // 40n  (左シフト)
console.log(a >> 1n);  // 5n   (右シフト)

// 権限システムの例
const READ    = 1n << 0n;  // 1n
const WRITE   = 1n << 1n;  // 2n
const DELETE  = 1n << 2n;  // 4n
const ADMIN   = 1n << 3n;  // 8n

const userPermissions = READ | WRITE;  // 3n

function hasPermission(userPerms, perm) {
  return (userPerms & perm) === perm;
}

console.log(hasPermission(userPermissions, READ));   // true
console.log(hasPermission(userPermissions, DELETE)); // false
```

## MathオブジェクトでのBigIntの制限

`Math` オブジェクトのメソッドは BigInt をサポートしていません：

```js
// Math.max / Math.min は BigInt をサポートしていない
// Math.max(10n, 20n); // TypeError

// 手動実装
function maxBigInt(a, b) {
  return a > b ? a : b;
}

function minBigInt(a, b) {
  return a < b ? a : b;
}

// Array.sort は BigInt に有効
const nums = [3n, 1n, 4n, 1n, 5n, 9n];
nums.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
console.log(nums); // [1n, 1n, 3n, 4n, 5n, 9n]
```

## 型の判定

```js
const bigNum = 9007199254740993n;
const regularNum = 42;

typeof bigNum;     // "bigint"
typeof regularNum; // "number"

// 安全な型チェック
function ensureBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  throw new Error(`Cannot convert ${typeof value} to BigInt`);
}
```

## ブラウザとNode.jsの互換性

- Chrome 67+ — 対応
- Firefox 68+ — 対応
- Safari 14+ — 対応
- Edge 79+ — 対応
- Node.js 10.4+ — 対応
- IE — 非対応

サポートされていない環境では、`big-integer` や `bignumber.js` などのポリフィルを使用できます：

```js
import bigInt from 'big-integer';

const a = bigInt('9007199254740993');
const b = a.add(1);
console.log(b.toString()); // "9007199254740994"
```

## まとめ

- BigInt は Number 型の安全な整数範囲の制限を解決し、任意の精度の整数を表現できます
- 数値の後に `n` を付けるか、`BigInt()` コンストラクタで BigInt 値を作成します
- BigInt と Number は混合演算できず、明示的な変換が必要です
- 実践的なシナリオ：データベースの 64 ビット ID、金融金額計算、ビット演算権限システム
- BigInt は `Math` オブジェクトのメソッドをサポートしておらず、JSON シリアライズにはカスタム処理が必要です
- 2019 年時点で主要ブラウザと Node.js 10.4+ が対応しており、IE は非対応のためポリフィルが必要です
