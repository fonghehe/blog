---
title: "JavaScript BigInt 大整數實踐"
date: 2019-09-11 15:50:18
tags:
  - JavaScript
readingTime: 3
description: "JavaScript 的 `Number` 型別基於 IEEE 754 雙精度浮點數，安全整數範圍為 `-(2^53 - 1)` 到 `2^53 - 1`（即 `Number.MAX_SAFE_INTEGER` 和 `Number.MIN_SAFE_INTEGER`）。超過這個範圍的整數運算就會出現精度丟失。ES202"
wordCount: 397
---

JavaScript 的 `Number` 型別基於 IEEE 754 雙精度浮點數，安全整數範圍為 `-(2^53 - 1)` 到 `2^53 - 1`（即 `Number.MAX_SAFE_INTEGER` 和 `Number.MIN_SAFE_INTEGER`）。超過這個範圍的整數運算就會出現精度丟失。ES2020 引入的 `BigInt` 型別讓我們可以表示任意精度的整數。本文將深入講解 BigInt 的使用場景、語法和注意事項。

## Number 精度問題演示

```js
// Number.MAX_SAFE_INTEGER = 9007199254740991
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991

// 超出安全整數範圍
console.log(9007199254740991 + 1); // 9007199254740992 (正確)
console.log(9007199254740991 + 2); // 9007199254740992 (錯誤！應該是 9007199254740993)

// 實際業務中的精度問題
const userId = 123456789012345678;
console.log(userId); // 123456789012345680 (最後兩位變了！)

// 資料庫中 64 位 ID 傳到前端後精度丟失
const orderId = '201908010000000001';
console.log(Number(orderId)); // 201908010000000000 (最後一位變成了0)
```

## BigInt 基礎用法

```js
// 建立 BigInt 的兩種方式
const a = 9007199254740993n;                    // 字面量方式：數字後加 n
const b = BigInt('9007199254740993');           // 建構函式方式

// 從數字建立
const c = BigInt(9007199254740993);             // 不推薦，可能丟失精度
const d = BigInt('9007199254740993');           // 推薦，從字串建立

// 基本運算
console.log(10n + 20n);    // 30n
console.log(10n - 20n);    // -10n
console.log(10n * 20n);    // 200n
console.log(10n / 3n);     // 3n (整數除法，截斷小數)
console.log(10n % 3n);     // 1n
console.log(10n ** 3n);    // 1000n

// 比較運算
console.log(10n > 5n);     // true
console.log(10n === 10);   // false (型別不同)
console.log(10n == 10);    // true (寬鬆相等)
console.log(10n < 11);     // true

// 一元運算子
console.log(-10n);         // -10n
console.log(+10n);         // TypeError: Cannot convert a BigInt value to a number
```

## BigInt 與 Number 不能混算

BigInt 和 Number 不能直接混合運算，必須先轉換型別：

```js
// 錯誤：不能混算
// 10n + 10; // TypeError: Cannot mix BigInt and other types

// 正確：轉換後計算
const result1 = 10n + BigInt(10);   // 20n
const result2 = Number(10n) + 10;   // 20
const result3 = 10n + BigInt('10'); // 20n

// 使用條件判斷選擇型別
function safeAdd(a, b) {
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    return BigInt(a) + BigInt(b);
  }
  return a + b;
}
```

## 實戰：處理資料庫 ID

```js
// 後端返回的使用者 ID（64位整數）
const userId = '1234567890123456789';

// 轉為 BigInt 處理
const id = BigInt(userId);

// ID 比較
function compareId(id1, id2) {
  return BigInt(id1) === BigInt(id2);
}

// ID 運算（如生成子 ID）
function generateChildId(parentId, index) {
  const parent = BigInt(parentId);
  const offset = BigInt(index);
  return (parent << 8n) | offset; // 位運算
}

// 序列化為 JSON
function toJson(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

// 反序列化
function fromJson(json) {
  return JSON.parse(json, (key, value) => {
    // 嘗試將數字字串轉為 BigInt
    if (typeof value === 'string' && /^\d{16,}$/.test(value)) {
      return BigInt(value);
    }
    return value;
  });
}

const user = {
  id: 1234567890123456789n,
  name: '張三',
};

console.log(toJson(user));
// {"id":"1234567890123456789","name":"張三"}
```

## 實戰：精確的金額計算

金融場景中，金額通常以最小單位（如分）儲存為整數：

```js
// 金額計算（以分為單位）
const price1 = 9999n;       // 99.99 元
const price2 = 8888n;       // 88.88 元
const discount = 100n;      // 1.00 元優惠

const total = price1 + price2 - discount; // 18787 分 = 187.87 元

// 格式化為元
function formatCurrency(cents) {
  const str = cents.toString();
  const yuan = str.slice(0, -2) || '0';
  const jiao = str.slice(-2).padStart(2, '0');
  return `${yuan}.${jiao}`;
}

console.log(formatCurrency(total)); // "187.87"

// 百分比折扣
function applyDiscount(price, percentOff) {
  // percentOff: 折扣百分比（如 85 表示 85 折）
  return (price * BigInt(percentOff)) / 100n;
}

const salePrice = applyDiscount(10000n, 85); // 8500n = 85.00 元
console.log(formatCurrency(salePrice)); // "85.00"
```

## BigInt 的位運算

BigInt 支援所有整數位運算：

```js
const a = 0b1010n;  // 10
const b = 0b1100n;  // 12

console.log(a & b);   // 0b1000n = 8  (AND)
console.log(a | b);   // 0b1110n = 14 (OR)
console.log(a ^ b);   // 0b0110n = 6  (XOR)
console.log(~a);      // -11n         (NOT)

console.log(a << 2n);  // 40n  (左移)
console.log(a >> 1n);  // 5n   (右移)

// 許可權系統示例
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

## BigInt 在 Math 物件中的限製

`Math` 物件的方法不支援 BigInt：

```js
// Math.max / Math.min 不支援 BigInt
// Math.max(10n, 20n); // TypeError

// 手動實現
function maxBigInt(a, b) {
  return a > b ? a : b;
}

function minBigInt(a, b) {
  return a < b ? a : b;
}

// Array.sort 對 BigInt 有效
const nums = [3n, 1n, 4n, 1n, 5n, 9n];
nums.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
console.log(nums); // [1n, 1n, 3n, 4n, 5n, 9n]
```

## 型別判斷

```js
const bigNum = 9007199254740993n;
const regularNum = 42;

typeof bigNum;     // "bigint"
typeof regularNum; // "number"

// 安全的型別檢查
function ensureBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  throw new Error(`Cannot convert ${typeof value} to BigInt`);
}
```

## 瀏覽器和 Node.js 相容性

- Chrome 67+ — 支援
- Firefox 68+ — 支援
- Safari 14+ — 支援
- Edge 79+ — 支援
- Node.js 10.4+ — 支援
- IE — 不支援

對於不支援的環境，可以使用 `big-integer` 或 `bignumber.js` 等 polyfill：

```js
import bigInt from 'big-integer';

const a = bigInt('9007199254740993');
const b = a.add(1);
console.log(b.toString()); // "9007199254740994"
```

## 小結

- BigInt 解決了 Number 型別的安全整數範圍限製，可以表示任意精度的整數
- 使用 `數字後加 n` 或 `BigInt()` 建構函式建立 BigInt 值
- BigInt 和 Number 不能混合運算，需要顯式轉換
- 實際場景：資料庫 64 位 ID、金融金額計算、位運算許可權系統
- BigInt 不支援 `Math` 物件的方法，JSON 序列化需要自定義處理
- 2019 年主流瀏覽器和 Node.js 10.4+ 已支援，IE 不支援需使用 polyfill
