---
title: "Node.js 18 LTS：内蔵 Fetch、テストランナー、その他"
date: 2022-06-21 09:48:11
tags:
  - Node.js
  - TypeScript
readingTime: 2
description: "Node.js 18 在 2022 年 4 月进入 LTS。这是个重要版本——内置了 fetch API、新增了测试运行器，还默认启用了 OpenSSL 3.0。作为前端基础设施的搭建者，这些变化直接影响我们的工具链。"
---

Node.js 18 在 2022 年 4 月进入 LTS。这是个重要版本——内置了 fetch API、新增了测试运行器，还默认启用了 OpenSSL 3.0。作为前端基础设施的搭建者，这些变化直接影响我们的工具链。

## 内置 fetch API

不再需要安装 node-fetch 或 axios 做简单请求：

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

配合 `FormData`、`Headers`、`Request`、`Response` 全部内置。

## 内蔵テストランナー

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

不需要装 Jest 或 Mocha，Node.js 自带了。对于工具脚本和 CLI 项目，内置测试运行器够用了。

## Blob 和 Web Streams

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

## ES2022 支持

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

## 实用的新 API

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

## 性能改进

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

## まとめ

Node.js 18 把很多之前需要第三方库的功能内置了——fetch、测试、Blob、Streams。这意味着更少的依赖、更小的 node_modules、更一致的 API。对于新项目，直接用 Node 18 不需要犹豫。