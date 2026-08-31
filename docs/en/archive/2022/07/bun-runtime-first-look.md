---
title: "Bun: The New Challenger in JavaScript Runtimes"
date: 2022-07-26 10:22:05
tags:
  - Frontend
readingTime: 2
description: "In July 2022, Jarred Sumner released Bun — a JavaScript runtime written in Zig. Its goal is ambitious: replace Node.js, npm, esbuild, and Jest to become the unified solution for the JavaScript toolchain."
wordCount: 238
---

In July 2022, Jarred Sumner released Bun — a JavaScript runtime written in Zig. Its goal is ambitious: replace Node.js, npm, esbuild, and Jest to become the unified solution for the JavaScript toolchain.

## Installation and Basic Usage

```bash
# 安装
curl -fsSL https://bun.sh/install | bash

# 验证
bun --version
# 0.1.x（2022 年 7 月）

# 运行 TypeScript 文件（不需要编译步骤）
bun run app.ts

# 运行 JSX/TSX
bun run App.tsx

# 包管理
bun install
bun add lodash
bun remove lodash
```

## How Fast Is It

```bash
# 运行 TypeScript 脚本
time bun run script.ts
# 0.02s

time npx ts-node script.ts
# 1.8s

time node --loader ts-node/esm script.ts
# 2.1s
```

Cold start is 100x faster. This is because Bun uses JavaScriptCore (Safari's engine) instead of V8, and implements low-level IO in Zig.

## As a Package Manager

```bash
# 安装依赖（比 pnpm 还快）
bun install

# 添加依赖
bun add react react-dom

# 查看安装速度
time bun install
# node_modules: 0.3s

time pnpm install
# node_modules: 2.8s
```

Bun uses hard links + global caching (similar to pnpm), but with a faster implementation.

## Built-in Bundler

```typescript
// 直接打包
bun build ./src/index.ts --outdir ./dist

// 带配置
bun build ./src/index.ts \
  --outdir ./dist \
  --minify \
  --sourcemap=external \
  --target=browser
```

```typescript
// build.ts
await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  minify: true,
  splitting: true, // 代码分割
  target: 'browser',
  format: 'esm',
});
```

## Built-in Test Runner

```typescript
// math.test.ts
import { expect, test, describe } from 'bun:test';
import { add, multiply } from './math';

describe('math', () => {
  test('加法', () => {
    expect(add(1, 2)).toBe(3);
  });

  test('乘法', () => {
    expect(multiply(3, 4)).toBe(12);
  });
});

// 运行
// bun test
```

Bun's test runner is compatible with the Jest API, but much faster.

## HTTP Server

```typescript
// server.ts
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/hello') {
      return Response.json({ message: 'Hello from Bun!' });
    }

    if (url.pathname === '/api/stream') {
      // 流式响应
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: hello\n\n'));
            controller.close();
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
```

Performance comparison (simple JSON response):

```
Node.js (http):     ~50,000 req/s
Deno (oak):         ~80,000 req/s
Bun (Bun.serve):   ~250,000 req/s
```

## File I/O

```typescript
// 读文件（比 Node.js 快 10x）
const file = Bun.file('data.json');
const data = await file.json();

// 写文件
await Bun.write('output.txt', 'Hello, Bun!');

// 复制文件
const src = Bun.file('source.txt');
await Bun.write('dest.txt', src);

// 文件信息
console.log(file.size);     // 字节
console.log(file.type);     // MIME 类型
console.log(file.lastModified);
```

## Real-World Problems

In July 2022, Bun was still very early:

1. **Compatibility**: not all npm packages work, especially those using Node.js native modules
2. **Stability**: still at 0.x, APIs may change
3. **Ecosystem**: no community plugins or toolchain
4. **Windows support**: not available yet in 2022

```bash
# 测试你的项目兼容性
bun install
bun test
# 大概率会遇到某些包不兼容
```

## Positioning Against Node.js and Deno

| Feature | Node.js | Deno | Bun |
|------|---------|------|-----|
| Engine | V8 | V8 | JavaScriptCore |
| Language | C++ | Rust | Zig |
| TypeScript | Requires compilation | Native support | Native support |
| Package management | npm/pnpm/yarn | URL imports | Built-in |
| Testing | Requires framework | Built-in | Built-in |
| Maturity | Production-ready | Fairly mature | Early stage |

## Summary

Bun's direction is right — unifying the JavaScript toolchain and reducing fragmentation. In 2022, Bun isn't production-ready yet, but its speed is impressive. Keep an eye on its development, but don't rush to migrate. 2023 will be a pivotal year for Bun.