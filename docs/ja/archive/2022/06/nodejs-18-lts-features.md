---
title: "Node.js 18 LTS：内蔵 Fetch、テストランナー、その他"
date: 2022-06-21 09:48:11
tags:
  - Node.js
  - TypeScript
readingTime: 3
description: "Node.js 18 は2022年4月に LTS 入りしました。これは重要なバージョンです。fetch API が内蔵され、新しいテストランナーが追加され、OpenSSL 3.0 がデフォルトで有効化されました。フロントエンドインフラストラクチャの構築者として、これらの変更は直接ツールチェーンに影響を与えます。"
wordCount: 378
---

Node.js 18 は 2022 年 4 月に LTS 入りしました。これは重要なバージョンです——fetch API が内蔵され、新しいテストランナーが追加され、OpenSSL 3.0 がデフォルトで有効化されました。フロントエンドインフラストラクチャの構築者として、これらの変更は直接ツールチェーンに影響を与えます。

## 組み込み fetch API

簡単なリクエストに node-fetch や axios をインストールする必要はもうありません：

```typescript
// そのまま使用可能！import 不要
const response = await fetch('https://api.example.com/users');
const users = await response.json();

// 完全な使用例
const res = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'test' }),
  signal: AbortSignal.timeout(5000), // 5 秒タイムアウト
});

// ストリーム処理
const stream = res.body;
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}
```

`FormData`、`Headers`、`Request`、`Response` もすべて内蔵されています。

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
# テストを実行
node --test sum.test.ts

# ディレクトリ内のすべてのテストを実行
node --test src/**/*.test.ts
```

Jest や Mocha をインストールする必要はありません。Node.js に標準で備わっています。ツールスクリプトや CLI プロジェクトでは、内蔵のテストランナーで十分です。

## Blob と Web Streams

```typescript
// Blob 内蔵
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
// 出力: HELLO, WORLD
```

## Timers Promises API

```typescript
import { setTimeout, setInterval } from 'node:timers/promises';

// 1 秒待機
await setTimeout(1000);

// AbortSignal 付きタイムアウト
const controller = new AbortController();
setTimeout(1000, 'timeout', { signal: controller.signal })
  .then(() => console.log('timeout'))
  .catch(e => console.log('キャンセルされました'));

// 非同期イテレータスタイルの setInterval
for await (const _ of setInterval(1000)) {
  console.log('1秒ごとに実行');
}
```

## ES2022 サポート

```typescript
// Top-level await（モジュールトップレベルで直接 await を使用）
const config = await fetch('/config.json').then(r => r.json());
export { config };

// Error.cause
try {
  await fetchData();
} catch (e) {
  throw new Error('リクエスト失敗', { cause: e });
}

// Array.at()
const arr = [1, 2, 3, 4, 5];
console.log(arr.at(-1)); // 5

// Object.hasOwn()
const obj = { a: 1 };
console.log(Object.hasOwn(obj, 'a')); // true
```

## 便利な新 API

```typescript
// グローバルオブジェクト
console.log(globalThis); // どの環境でもグローバルオブジェクトを指す

// Array.findLast / findLastIndex
const numbers = [1, 2, 3, 4, 5];
const lastEven = numbers.findLast(n => n % 2 === 0); // 4
const lastEvenIdx = numbers.findLastIndex(n => n % 2 === 0); // 3

// 正規表現マッチインデックス
const re = /(?<year>\d{4})-(?<month>\d{2})/d;
const match = re.exec('2022-06');
console.log(match.indices.groups.year); // [0, 4]
```

## パフォーマンス改善

```bash
# V8 エンジンが 10.1 にアップグレード
# 配列操作がより高速に
node -e "
const arr = Array.from({length: 1e6}, (_, i) => i);
console.time('map');
arr.map(x => x * 2);
console.timeEnd('map');
"
```

## CI での使用

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

Node.js 18 は、これまでサードパーティライブラリが必要だった多くの機能を内蔵しました——fetch、テスト、Blob、Streams。これはより少ない依存関係、より小さな node_modules、より一貫した API を意味します。新規プロジェクトでは、迷わず Node 18 を直接使用してください。
