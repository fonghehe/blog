---
title: "ES2022 特性全指南：這些 API 你該用起來了"
date: 2022-12-06 15:28:52
tags:
  - 前端
readingTime: 2
description: "ES2022（ES13）已經全面落地了。TypeScript 4.7+、Node.js 18、主流瀏覽器全部支持。這篇文章整理了 ES2022 的核心特性，每個都附上實際應用場景。"
---

ES2022（ES13）已經全面落地了。TypeScript 4.7+、Node.js 18、主流瀏覽器全部支持。這篇文章整理了 ES2022 的核心特性，每個都附上實際應用場景。

## Top-Level Await

模塊頂層可以直接用 await，不需要 async 函數包裹：

```typescript
// config.ts — 直接在頂層 await
const response = await fetch('/config.json');
export const config = await response.json();

// db.ts — 初始化數據庫連接
const connection = await createConnection({
  host: 'localhost',
  port: 5432,
  database: 'app',
});
export { connection };

// main.ts — 導入時自動等待初始化完成
import { config } from './config.js';
import { connection } from './db.js';

// config 和 connection 都已經 ready
console.log(config.apiUrl);
```

消費方 import 時會自動等待所有依賴的頂層 await 完成。

## Error.cause

錯誤鏈更清晰了：

```typescript
class ApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiError';
  }
}

async function fetchUser(id: string) {
  try {
    const res = await fetch(`/api/users/${id}`);
    return await res.json();
  } catch (e) {
    throw new ApiError('獲取用户失敗', { cause: e });
  }
}

try {
  await fetchUser('123');
} catch (e) {
  console.log(e.message);              // '獲取用户失敗'
  console.log(e.cause);                // TypeError: Failed to fetch
  console.log(e.cause.stack);          // 原始錯誤的堆棧
}
```

在錯誤邊界和日誌系統中特別有用——完整的錯誤鏈。

## Object.hasOwn()

替代 `hasOwnProperty` 的更簡潔寫法：

```typescript
const user = { name: 'Alice', age: 30 };

// 以前
if (user.hasOwnProperty('name')) { ... }

// ES2022
if (Object.hasOwn(user, 'name')) { ... }

// 處理 null prototype 對象
const dict = Object.create(null);
dict.key = 'value';

// dict.hasOwnProperty 不存在，會報錯
// Object.hasOwn 安全
Object.hasOwn(dict, 'key'); // true
```

## Array.at()

負索引，告別 `arr[arr.length - 1]`：

```typescript
const arr = [1, 2, 3, 4, 5];

arr.at(0);     // 1（第一個）
arr.at(-1);    // 5（最後一個）
arr.at(-2);    // 4（倒數第二個）

// 實用場景
function getLastItem<T>(arr: T[]): T | undefined {
  return arr.at(-1);
}

// 字符串也能用
'hello'.at(-1); // 'o'
```

## Object.fromEntries() 的改進

```typescript
// 從 Map 創建對象
const map = new Map([
  ['name', 'Alice'],
  ['age', 30],
]);
const obj = Object.fromEntries(map);
// { name: 'Alice', age: 30 }

// 實用：過濾對象屬性
function omit<T extends Record<string, unknown>>(
  obj: T,
  keys: string[]
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key))
  );
}

const user = { name: 'Alice', password: '123', age: 30 };
omit(user, ['password']);
// { name: 'Alice', age: 30 }
```

## 正則匹配索引

```typescript
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/d;
const match = re.exec('2022-12-06');

// 匹配的索引位置
console.log(match.indices[0]);          // [0, 10] 整體匹配
console.log(match.indices.groups.year); // [0, 4]
console.log(match.indices.groups.month);// [5, 7]
console.log(match.indices.groups.day);  // [8, 10]

// 實用：高亮匹配的文本
function highlightMatches(text: string, pattern: RegExp): string {
  const re = new RegExp(pattern.source, 'd' + pattern.flags);
  let result = text;
  let offset = 0;

  for (const match of text.matchAll(re)) {
    const [start, end] = match.indices[0];
    const highlighted = `<mark>${match[0]}</mark>`;
    result = result.slice(0, start + offset)
      + highlighted
      + result.slice(end + offset);
    offset += highlighted.length - (end - start);
  }

  return result;
}
```

## Class Fields

```typescript
class Component {
  // 公有字段
  name = 'Component';

  // 私有字段（真正的私有，不是 TypeScript 的 #）
  #initialized = false;
  #listeners: Array<() => void> = [];

  // 靜態公有字段
  static version = '1.0.0';

  // 靜態私有字段
  static #instanceCount = 0;

  constructor() {
    Component.#instanceCount++;
  }

  // 私有方法
  #setup() {
    this.#initialized = true;
  }

  init() {
    if (!this.#initialized) {
      this.#setup();
    }
  }

  static getCount() {
    return Component.#instanceCount;
  }
}
```

## Array.findLast() / findLastIndex()

```typescript
const numbers = [1, 2, 3, 4, 5, 6];

// 從後往前找
numbers.findLast(n => n % 2 === 0);        // 6
numbers.findLastIndex(n => n % 2 === 0);   // 5

// 實用：找最近的日誌錯誤
const logs = [
  { level: 'info', msg: '啓動' },
  { level: 'error', msg: '連接失敗' },
  { level: 'info', msg: '重試' },
  { level: 'error', msg: '超時' },
];

const lastError = logs.findLast(log => log.level === 'error');
// { level: 'error', msg: '超時' }
```

## 小結

ES2022 的特性都是實用型改進：Top-Level Await 簡化模塊初始化、Error.cause 完善錯誤鏈、Array.at() 終於來了。這些特性在 TypeScript 4.7+ 和 Node.js 18 中已經完全可用，沒有理由不用。