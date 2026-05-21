---
title: "Node.js 18 LTS：內置 Fetch、測試運行器和更多"
date: 2022-06-21 09:48:11
tags:
  - Node.js
  - TypeScript
readingTime: 2
description: "Node.js 18 在 2022 年 4 月進入 LTS。這是個重要版本——內置了 fetch API、新增了測試運行器，還默認啓用了 OpenSSL 3.0。作為前端基礎設施的搭建者，這些變化直接影響我們的工具鏈。"
wordCount: 212
---

Node.js 18 在 2022 年 4 月進入 LTS。這是個重要版本——內置了 fetch API、新增了測試運行器，還默認啓用了 OpenSSL 3.0。作為前端基礎設施的搭建者，這些變化直接影響我們的工具鏈。

## 內置 fetch API

不再需要安裝 node-fetch 或 axios 做簡單請求：

```typescript
// 直接用！不需要 import
const response = await fetch('https://api.example.com/users');
const users = await response.json();

// 完整用法
const res = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'test' }),
  signal: AbortSignal.timeout(5000), // 5 秒超時
});

// 流式處理
const stream = res.body;
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

配合 `FormData`、`Headers`、`Request`、`Response` 全部內置。

## 內置測試運行器

```typescript
// sum.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum';

describe('sum', () => {
  it('兩數相加', () => {
    assert.strictEqual(sum(1, 2), 3);
  });

  it('負數相加', () => {
    assert.strictEqual(sum(-1, -2), -3);
  });
});

// Mock
import { mock } from 'node:test';

it('mock 函數', () => {
  const fn = mock.fn();
  fn(42);
  assert.strictEqual(fn.mock.calls.length, 1);
  assert.deepStrictEqual(fn.mock.calls[0].arguments, [42]);
});
```

```bash
# 運行測試
node --test sum.test.ts

# 運行目錄下所有測試
node --test src/**/*.test.ts
```

不需要裝 Jest 或 Mocha，Node.js 自帶了。對於工具腳本和 CLI 項目，內置測試運行器夠用了。

## Blob 和 Web Streams

```typescript
// Blob 內置
const blob = new Blob(['Hello, World!'], { type: 'text/plain' });
console.log(blob.size);  // 13
console.log(blob.type);  // text/plain

// Web Streams API
import { ReadableStream, WritableStream, TransformStream } from 'node:stream/web';

const readable = new ReadableStream({
  start(controller) {
    controller.enqueue('Hello');
    controller.enqueue('World');
    controller.close();
  },
});

const transform = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  },
});

const writable = new WritableStream({
  write(chunk) {
    console.log(chunk);
  },
});

await readable.pipeThrough(transform).pipeTo(writable);
// 輸出: HELLO, WORLD
```

## Timers Promises API

```typescript
import { setTimeout, setInterval } from 'node:timers/promises';

// 等待 1 秒
await setTimeout(1000);

// 帶 AbortSignal 的超時
const controller = new AbortController();
setTimeout(1000, 'timeout', { signal: controller.signal })
  .then(() => console.log('超時'))
  .catch(e => console.log('被取消'));

// 異步迭代器風格的 setInterval
for await (const _ of setInterval(1000)) {
  console.log('每秒執行一次');
}
```

## ES2022 支持

```typescript
// Top-level await（模塊頂層直接用 await）
const config = await fetch('/config.json').then(r => r.json());
export { config };

// Error.cause
try {
  await fetchData();
} catch (e) {
  throw new Error('請求失敗', { cause: e });
}

// Array.at()
const arr = [1, 2, 3, 4, 5];
console.log(arr.at(-1)); // 5

// Object.hasOwn()
const obj = { a: 1 };
console.log(Object.hasOwn(obj, 'a')); // true
```

## 實用的新 API

```typescript
// 全局對象
console.log(globalThis); // 在任何環境都指向全局對象

// Array.findLast / findLastIndex
const numbers = [1, 2, 3, 4, 5];
const lastEven = numbers.findLast(n => n % 2 === 0); // 4
const lastEvenIdx = numbers.findLastIndex(n => n % 2 === 0); // 3

// 正則匹配索引
const re = /(?<year>\d{4})-(?<month>\d{2})/d;
const match = re.exec('2022-06');
console.log(match.indices.groups.year); // [0, 4]
```

## 性能改進

```bash
# V8 引擎升級到 10.1
# 數組操作更快
node -e "
const arr = Array.from({length: 1e6}, (_, i) => i);
console.time('map');
arr.map(x => x * 2);
console.timeEnd('map');
"
```

## 在 CI 中使用

```yaml
# .github/workflows/ci.yml
name: CI
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
```

## 小結

Node.js 18 把很多之前需要第三方庫的功能內置了——fetch、測試、Blob、Streams。這意味着更少的依賴、更小的 node_modules、更一致的 API。對於新項目，直接用 Node 18 不需要猶豫。