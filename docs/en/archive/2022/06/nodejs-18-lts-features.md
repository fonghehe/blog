---
title: "Node.js 18 LTS: Built-in Fetch, Test Runner, and More"
date: 2022-06-21 09:48:11
tags:
  - Node.js
  - TypeScript
readingTime: 2
description: "Node.js 18 entered LTS in April 2022. It's an important release — with a built-in fetch API, a new test runner, and OpenSSL 3.0 enabled by default. As builders of frontend infrastructure, these changes directly affect our toolchain."
wordCount: 145
---

Node.js 18 entered LTS in April 2022. It's an important release — with a built-in fetch API, a new test runner, and OpenSSL 3.0 enabled by default. As builders of frontend infrastructure, these changes directly affect our toolchain.

## Built-in fetch API

No need to install node-fetch or axios for simple requests anymore:

```typescript
// 直接用！不需要 import
const response = await fetch('https://api.example.com/users');
const users = await response.json();

// 完整用法
const res = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'test' }),
  signal: AbortSignal.timeout(5000), // 5 秒超时
});

// 流式处理
const stream = res.body;
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

`FormData`, `Headers`, `Request`, and `Response` are all built in as well.

## Built-in Test Runner

```typescript
// sum.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum';

describe('sum', () => {
  it('两数相加', () => {
    assert.strictEqual(sum(1, 2), 3);
  });

  it('负数相加', () => {
    assert.strictEqual(sum(-1, -2), -3);
  });
});

// Mock
import { mock } from 'node:test';

it('mock 函数', () => {
  const fn = mock.fn();
  fn(42);
  assert.strictEqual(fn.mock.calls.length, 1);
  assert.deepStrictEqual(fn.mock.calls[0].arguments, [42]);
});
```

```bash
# 运行测试
node --test sum.test.ts

# 运行目录下所有测试
node --test src/**/*.test.ts
```

No need to install Jest or Mocha — Node.js has it built in. For utility scripts and CLI projects, the built-in test runner is sufficient.

## Blob and Web Streams

```typescript
// Blob 内置
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
// 输出: HELLO, WORLD
```

## Timers Promises API

```typescript
import { setTimeout, setInterval } from 'node:timers/promises';

// 等待 1 秒
await setTimeout(1000);

// 带 AbortSignal 的超时
const controller = new AbortController();
setTimeout(1000, 'timeout', { signal: controller.signal })
  .then(() => console.log('超时'))
  .catch(e => console.log('被取消'));

// 异步迭代器风格的 setInterval
for await (const _ of setInterval(1000)) {
  console.log('每秒执行一次');
}
```

## ES2022 Support

```typescript
// Top-level await（模块顶层直接用 await）
const config = await fetch('/config.json').then(r => r.json());
export { config };

// Error.cause
try {
  await fetchData();
} catch (e) {
  throw new Error('请求失败', { cause: e });
}

// Array.at()
const arr = [1, 2, 3, 4, 5];
console.log(arr.at(-1)); // 5

// Object.hasOwn()
const obj = { a: 1 };
console.log(Object.hasOwn(obj, 'a')); // true
```

## Useful New APIs

```typescript
// 全局对象
console.log(globalThis); // 在任何环境都指向全局对象

// Array.findLast / findLastIndex
const numbers = [1, 2, 3, 4, 5];
const lastEven = numbers.findLast(n => n % 2 === 0); // 4
const lastEvenIdx = numbers.findLastIndex(n => n % 2 === 0); // 3

// 正则匹配索引
const re = /(?<year>\d{4})-(?<month>\d{2})/d;
const match = re.exec('2022-06');
console.log(match.indices.groups.year); // [0, 4]
```

## Performance Improvements

```bash
# V8 引擎升级到 10.1
# 数组操作更快
node -e "
const arr = Array.from({length: 1e6}, (_, i) => i);
console.time('map');
arr.map(x => x * 2);
console.timeEnd('map');
"
```

## Using in CI

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

## Summary

Node.js 18 brings many previously third-party features built in — fetch, testing, Blob, Streams. This means fewer dependencies, smaller node_modules, and more consistent APIs. For new projects, there's no hesitation needed — just use Node 18.