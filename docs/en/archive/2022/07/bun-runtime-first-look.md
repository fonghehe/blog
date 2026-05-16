---
title: "Bun: The New Challenger in JavaScript Runtimes"
date: 2022-07-26 10:22:05
tags:
  - Frontend
readingTime: 2
description: "2022 年 7 月，Jarred Sumner 发布了 Bun——一个用 Zig 编写的 JavaScript 运行时。它的目标很激进：替代 Node.js、npm、esbuild、Jest，成为 JavaScript 工具链的统一解决方案。"
---

2022 年 7 月，Jarred Sumner 发布了 Bun——一个用 Zig 编写的 JavaScript 运行时。它的目标很激进：替代 Node.js、npm、esbuild、Jest，成为 JavaScript 工具链的统一解决方案。

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

冷启动快了 100 倍。这是因为 Bun 用 JavaScriptCore（Safari 的引擎）而不是 V8，并且用 Zig 写了底层 IO。

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

Bun 使用硬链接 + 全局缓存（和 pnpm 类似），但实现更快。

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

Bun 的测试运行器兼容 Jest API，但快得多。

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

性能对比（简单的 JSON 响应）：

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

2022 年 7 月的 Bun 还很早期：

1. **兼容性**：不是所有 npm 包都能跑，尤其是用了 Node.js 原生模块的
2. **稳定性**：还在 0.x 版本，API 可能变化
3. **生态**：没有社区插件和工具链
4. **Windows 支持**：2022 年还没有

```bash
# 测试你的项目兼容性
bun install
bun test
# 大概率会遇到某些包不兼容
```

## Positioning Against Node.js and Deno

| 特性 | Node.js | Deno | Bun |
|------|---------|------|-----|
| 引擎 | V8 | V8 | JavaScriptCore |
| 语言 | C++ | Rust | Zig |
| TypeScript | 需要编译 | 原生支持 | 原生支持 |
| 包管理 | npm/pnpm/yarn | URL 导入 | 内置 |
| 测试 | 需要框架 | 内置 | 内置 |
| 成熟度 | 生产就绪 | 较成熟 | 早期 |

## Summary

Bun 的方向是对的——统一 JavaScript 工具链，减少碎片化。2022 年的 Bun 还不适合生产环境，但它的速度表现令人印象深刻。关注它的发展，但别急着迁移。2023 年会是 Bun 关键的一年。