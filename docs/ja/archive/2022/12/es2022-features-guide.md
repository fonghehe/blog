---
title: "ES2022 機能完全ガイド：今すぐ使うべき API"
date: 2022-12-06 15:28:52
tags:
  - フロントエンド
readingTime: 2
description: "ES2022（ES13）已经全面落地了。TypeScript 4.7+、Node.js 18、主流浏览器全部支持。这篇文章整理了 ES2022 的核心特性，每个都附上实际应用场景。"
wordCount: 229
---

ES2022（ES13）已经全面落地了。TypeScript 4.7+、Node.js 18、主流浏览器全部支持。这篇文章整理了 ES2022 的核心特性，每个都附上实际应用场景。

## トップレベル Await

模块顶层可以直接用 await，不需要 async 函数包裹：

```typescript
// config.ts — 直接在顶层 await
const response = await fetch('/config.json');
export const config = await response.json();

// db.ts — 初始化数据库连接
const connection = await createConnection({
  host: 'localhost',
  port: 5432,
  database: 'app',
});
export { connection };

// main.ts — 导入时自动等待初始化完成
import { config } from './config.js';
import { connection } from './db.js';

// config 和 connection 都已经 ready
console.log(config.apiUrl);
```

消费方 import 时会自动等待所有依赖的顶层 await 完成。

## Error.cause

错误链更清晰了：

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
    throw new ApiError('获取用户失败', { cause: e });
  }
}

try {
  await fetchUser('123');
} catch (e) {
  console.log(e.message);              // '获取用户失败'
  console.log(e.cause);                // TypeError: Failed to fetch
  console.log(e.cause.stack);          // 原始错误的堆栈
}
```

在错误边界和日志系统中特别有用——完整的错误链。

## Object.hasOwn()

替代 `hasOwnProperty` 的更简洁写法：

```typescript
const user = { name: 'Alice', age: 30 };

// 以前
if (user.hasOwnProperty('name')) { ... }

// ES2022
if (Object.hasOwn(user, 'name')) { ... }

// 处理 null prototype 对象
const dict = Object.create(null);
dict.key = 'value';

// dict.hasOwnProperty 不存在，会报错
// Object.hasOwn 安全
Object.hasOwn(dict, 'key'); // true
```

## Array.at()

负索引，告别 `arr[arr.length - 1]`：

```typescript
const arr = [1, 2, 3, 4, 5];

arr.at(0);     // 1（第一个）
arr.at(-1);    // 5（最后一个）
arr.at(-2);    // 4（倒数第二个）

// 实用场景
function getLastItem<T>(arr: T[]): T | undefined {
  return arr.at(-1);
}

// 字符串也能用
'hello'.at(-1); // 'o'
```

## Object.fromEntries() の改善

```typescript
// 从 Map 创建对象
const map = new Map([
  ['name', 'Alice'],
  ['age', 30],
]);
const obj = Object.fromEntries(map);
// { name: 'Alice', age: 30 }

// 实用：过滤对象属性
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

## 正規表現マッチインデックス

```typescript
const re = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/d;
const match = re.exec('2022-12-06');

// 匹配的索引位置
console.log(match.indices[0]);          // [0, 10] 整体匹配
console.log(match.indices.groups.year); // [0, 4]
console.log(match.indices.groups.month);// [5, 7]
console.log(match.indices.groups.day);  // [8, 10]

// 实用：高亮匹配的文本
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

## クラスフィールド

```typescript
class Component {
  // 公有字段
  name = 'Component';

  // 私有字段（真正的私有，不是 TypeScript 的 #）
  #initialized = false;
  #listeners: Array<() => void> = [];

  // 静态公有字段
  static version = '1.0.0';

  // 静态私有字段
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

// 从后往前找
numbers.findLast(n => n % 2 === 0);        // 6
numbers.findLastIndex(n => n % 2 === 0);   // 5

// 实用：找最近的日志错误
const logs = [
  { level: 'info', msg: '启动' },
  { level: 'error', msg: '连接失败' },
  { level: 'info', msg: '重试' },
  { level: 'error', msg: '超时' },
];

const lastError = logs.findLast(log => log.level === 'error');
// { level: 'error', msg: '超时' }
```

## まとめ

ES2022 的特性都是实用型改进：Top-Level Await 简化模块初始化、Error.cause 完善错误链、Array.at() 终于来了。这些特性在 TypeScript 4.7+ 和 Node.js 18 中已经完全可用，没有理由不用。