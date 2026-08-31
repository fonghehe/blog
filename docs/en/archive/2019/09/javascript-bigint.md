---
title: "JavaScript BigInt: Working with Large Integers"
date: 2019-09-11 15:50:18
tags:
  - JavaScript
readingTime: 3
description: "JavaScript's `Number` type is based on IEEE 754 double-precision floats, with a safe-integer range of `-(2^53 - 1)` to `2^53 - 1`. Integer arithmetic beyond this range loses precision. The `BigInt` type introduced in ES2020 lets us represent integers of arbitrary precision. This article takes an in-depth look at BigInt's use cases, syntax, and caveats."
wordCount: 254
---

JavaScript's `Number` type is based on IEEE 754 double-precision floats, with a safe-integer range of `-(2^53 - 1)` to `2^53 - 1` (i.e. `Number.MAX_SAFE_INTEGER` and `Number.MIN_SAFE_INTEGER`). Integer arithmetic beyond this range loses precision. The `BigInt` type introduced in ES2020 lets us represent integers of arbitrary precision. This article takes an in-depth look at BigInt's use cases, syntax, and caveats.

## Number Precision Issue Demo

```js
// Number.MAX_SAFE_INTEGER = 9007199254740991
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991

// 超出安全整数范围
console.log(9007199254740991 + 1); // 9007199254740992 (正确)
console.log(9007199254740991 + 2); // 9007199254740992 (错误！应该是 9007199254740993)

// 实际业务中的精度问题
const userId = 123456789012345678;
console.log(userId); // 123456789012345680 (最后两位变了！)

// 数据库中 64 位 ID 传到前端后精度丢失
const orderId = '201908010000000001';
console.log(Number(orderId)); // 201908010000000000 (最后一位变成了0)
```

## BigInt Basic Usage

```js
// 创建 BigInt 的两种方式
const a = 9007199254740993n;                    // 字面量方式：数字后加 n
const b = BigInt('9007199254740993');           // 构造函数方式

// 从数字创建
const c = BigInt(9007199254740993);             // 不推荐，可能丢失精度
const d = BigInt('9007199254740993');           // 推荐，从字符串创建

// 基本运算
console.log(10n + 20n);    // 30n
console.log(10n - 20n);    // -10n
console.log(10n * 20n);    // 200n
console.log(10n / 3n);     // 3n (整数除法，截断小数)
console.log(10n % 3n);     // 1n
console.log(10n ** 3n);    // 1000n

// 比较运算
console.log(10n > 5n);     // true
console.log(10n === 10);   // false (类型不同)
console.log(10n == 10);    // true (宽松相等)
console.log(10n < 11);     // true

// 一元运算符
console.log(-10n);         // -10n
console.log(+10n);         // TypeError: Cannot convert a BigInt value to a number
```

## BigInt and Number Cannot Be Mixed

BigInt and Number can't be mixed in operations directly; you must convert types first:

```js
// 错误：不能混算
// 10n + 10; // TypeError: Cannot mix BigInt and other types

// 正确：转换后计算
const result1 = 10n + BigInt(10);   // 20n
const result2 = Number(10n) + 10;   // 20
const result3 = 10n + BigInt('10'); // 20n

// 使用条件判断选择类型
function safeAdd(a, b) {
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    return BigInt(a) + BigInt(b);
  }
  return a + b;
}
```

## In Practice: Handling Database IDs

```js
// 后端返回的用户 ID（64位整数）
const userId = '1234567890123456789';

// 转为 BigInt 处理
const id = BigInt(userId);

// ID 比较
function compareId(id1, id2) {
  return BigInt(id1) === BigInt(id2);
}

// ID 运算（如生成子 ID）
function generateChildId(parentId, index) {
  const parent = BigInt(parentId);
  const offset = BigInt(index);
  return (parent << 8n) | offset; // 位运算
}

// 序列化为 JSON
function toJson(obj) {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

// 反序列化
function fromJson(json) {
  return JSON.parse(json, (key, value) => {
    // 尝试将数字字符串转为 BigInt
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

## In Practice: Precise Amount Calculations

In finance scenarios, amounts are usually stored as integers in the smallest unit (e.g. cents):

```js
// 金额计算（以分为单位）
const price1 = 9999n;       // 99.99 元
const price2 = 8888n;       // 88.88 元
const discount = 100n;      // 1.00 元优惠

const total = price1 + price2 - discount; // 18787 分 = 187.87 元

// 格式化为元
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

## BigInt Bitwise Operations

BigInt supports all integer bitwise operations:

```js
const a = 0b1010n;  // 10
const b = 0b1100n;  // 12

console.log(a & b);   // 0b1000n = 8  (AND)
console.log(a | b);   // 0b1110n = 14 (OR)
console.log(a ^ b);   // 0b0110n = 6  (XOR)
console.log(~a);      // -11n         (NOT)

console.log(a << 2n);  // 40n  (左移)
console.log(a >> 1n);  // 5n   (右移)

// 权限系统示例
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

## BigInt Limitations in the Math Object

The methods of the `Math` object don't support BigInt:

```js
// Math.max / Math.min 不支持 BigInt
// Math.max(10n, 20n); // TypeError

// 手动实现
function maxBigInt(a, b) {
  return a > b ? a : b;
}

function minBigInt(a, b) {
  return a < b ? a : b;
}

// Array.sort 对 BigInt 有效
const nums = [3n, 1n, 4n, 1n, 5n, 9n];
nums.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
console.log(nums); // [1n, 1n, 3n, 4n, 5n, 9n]
```

## Type Checking

```js
const bigNum = 9007199254740993n;
const regularNum = 42;

typeof bigNum;     // "bigint"
typeof regularNum; // "number"

// 安全的类型检查
function ensureBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string') return BigInt(value);
  throw new Error(`Cannot convert ${typeof value} to BigInt`);
}
```

## Browser and Node.js Compatibility

- Chrome 67+ — supported
- Firefox 68+ — supported
- Safari 14+ — supported
- Edge 79+ — supported
- Node.js 10.4+ — supported
- IE — not supported

For unsupported environments, you can use polyfills such as `big-integer` or `bignumber.js`:

```js
import bigInt from 'big-integer';

const a = bigInt('9007199254740993');
const b = a.add(1);
console.log(b.toString()); // "9007199254740994"
```

## Summary

- BigInt solves the safe-integer limit of the `Number` type, representing integers of arbitrary precision.
- Create BigInt values with the `n` suffix or the `BigInt()` constructor.
- BigInt and Number can't be mixed in operations; explicit conversion is required.
- Real-world scenarios: 64-bit database IDs, financial amount calculations, bitwise permission systems.
- BigInt isn't supported by `Math` object methods, and JSON serialization needs custom handling.
- By 2019, mainstream browsers and Node.js 10.4+ already supported it; IE doesn't, so a polyfill is needed.
