---
title: "Bun 1.0 Deep Dive: The New Contender in JavaScript Runtimes"
date: 2023-12-20 11:47:15
tags:
  - Frontend
readingTime: 2
description: "Bun 1.0 发布三个月了。在测试环境和几个小项目中深度使用后，写一份全面的评测。"
---

Bun 1.0 发布三个月了。在测试环境和几个小项目中深度使用后，写一份全面的评测。

## What is Bun

Bun 用 Zig 语言编写，底层使用 JavaScriptCore（Safari 的 JS 引擎）。它的目标是：替代 Node.js + npm + 测试框架，一个工具搞定一切。

## Performance Results

### 包安装

```bash
# 清空 node_modules 后重新安装（1200+ 依赖）
npm:     89s
pnpm:    24s
yarn:    62s
bun:     7s

# bun 的包安装速度是碾压级的
```

### 脚本执行

```typescript
// bench.ts
const start = performance.now();

const data = Array.from({ length: 1_000_000 }, (_, i) => ({
  id: i,
  name: `item-${i}`,
  value: Math.random(),
}));

const sorted = data.sort((a, b) => b.value - a.value);
const top100 = sorted.slice(0, 100);

console.log(`耗时: ${performance.now() - start}ms`);

// 结果：
// Node 20:  380ms
// Deno 1.38: 290ms
// Bun 1.0:  210ms
```

### HTTP 服务器

```typescript
// server.ts - Bun 原生 HTTP
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response(JSON.stringify({ hello: "world" }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`Listening on http://localhost:${server.port}`);

// 压测结果（requests/sec）：
// Node (fastify):  45,000
// Deno:            62,000
// Bun:            112,000
```

## Built-in Toolchain

### 测试运行器

```typescript
// math.test.ts
import { expect, test, describe } from "bun:test";
import { add, multiply } from "./math";

describe("math", () => {
  test("add", () => {
    expect(add(1, 2)).toBe(3);
  });

  test("multiply", () => {
    expect(multiply(3, 4)).toBe(12);
  });
});

// 运行：bun test
// 速度比 Vitest 还快 2-3 倍（因为不需要 worker 线程开销）
```

### 包管理器

```bash
# bun 直接替代 npm/pnpm
bun install
bun add zod
bun remove lodash
bun run build
bunx create-next-app
```

### 打包器

```typescript
// Bun 内置打包器
const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun", // 或 "browser"、"node"
  minify: true,
  splitting: true, // 代码分割
});

if (!result.success) {
  console.error(result.logs);
}
```

## Compatibility Issues

这是目前最大的挑战：

**能用的：**
- 大部分 npm 包
- Express、Hono、Elysia 等 HTTP 框架
- TypeScript 原生执行
- JSX/TSX 原生执行
- `.env` 文件自动加载

**有问题的：**
- `node:dgram`（UDP）部分 API 未实现
- `node:vm` 模块不完整
- 部分 Node.js C++ Addon 不兼容
- Prisma 需要特定配置
- NestJS 等重度 Node.js 框架运行不稳定

```typescript
// 检查兼容性
bun --bun run your-script.ts
// 如果报错，先用 node 运行，等 Bun 修复
```

## Practical Recommendations

**可以用 Bun 的场景：**
- 新的 API 服务（Hono / Elysia）
- CLI 工具
- 脚本和自动化
- 开发环境（装依赖、跑测试）
- 构建工具

**暂时不要用 Bun 的场景：**
- 大型生产 Node.js 应用
- 依赖特定 Node.js C++ Addon 的项目
- 需要完全 Node.js 兼容性的企业环境

## My Workflow

```jsonc
// package.json
{
  "scripts": {
    // 开发时用 Bun（快）
    "dev": "bun run dev:internal",
    "test": "bun test",
    "install": "bun install",
    // 生产部署暂用 Node（稳）
    "start": "node dist/index.js"
  }
}
```

开发阶段用 Bun 加速，生产环境暂时还是用 Node.js。等 Bun 的兼容性和稳定性再成熟一些再切。

## Summary

- Bun 的性能优势是真实的：包安装、脚本执行、HTTP 服务都明显更快
- 内置测试运行器、打包器、包管理器，一站式体验好
- Node.js 兼容性是最大短板，但改善速度很快
- 适合新项目和开发环境，大型生产项目暂时观望
- Bun vs Deno vs Node 的三方竞争对整个 JS 生态是好事