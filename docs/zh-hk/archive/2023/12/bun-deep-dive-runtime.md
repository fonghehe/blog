---
title: "Bun 1.0 深度評測：JavaScript 運行時的新競爭者"
date: 2023-12-20 11:47:15
tags:
  - 前端
readingTime: 2
description: "Bun 1.0 發佈三個月了。在測試環境和幾個小項目中深度使用後，寫一份全面的評測。"
wordCount: 437
---

Bun 1.0 發佈三個月了。在測試環境和幾個小項目中深度使用後，寫一份全面的評測。

## Bun 是什麼

Bun 用 Zig 語言編寫，底層使用 JavaScriptCore（Safari 的 JS 引擎）。它的目標是：替代 Node.js + npm + 測試框架，一個工具搞定一切。

## 效能表現

### 包安裝

```bash
# 清空 node_modules 後重新安裝（1200+ 依賴）
npm:     89s
pnpm:    24s
yarn:    62s
bun:     7s

# bun 的包安裝速度是碾壓級的
```

### 腳本執行

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

console.log(`耗時: ${performance.now() - start}ms`);

// 結果：
// Node 20:  380ms
// Deno 1.38: 290ms
// Bun 1.0:  210ms
```

### HTTP 服務器

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

// 壓測結果（requests/sec）：
// Node (fastify):  45,000
// Deno:            62,000
// Bun:            112,000
```

## 內置工具鏈

### 測試運行器

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

// 運行：bun test
// 速度比 Vitest 還快 2-3 倍（因為不需要 worker 線程開銷）
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
// Bun 內置打包器
const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun", // 或 "browser"、"node"
  minify: true,
  splitting: true, // 代碼分割
});

if (!result.success) {
  console.error(result.logs);
}
```

## 相容性問題

這是目前最大的挑戰：

**能用的：**
- 大部分 npm 包
- Express、Hono、Elysia 等 HTTP 框架
- TypeScript 原生執行
- JSX/TSX 原生執行
- `.env` 文件自動加載

**有問題的：**
- `node:dgram`（UDP）部分 API 未實現
- `node:vm` 模塊不完整
- 部分 Node.js C++ Addon 不兼容
- Prisma 需要特定設定
- NestJS 等重度 Node.js 框架運行不穩定

```typescript
// 檢查兼容性
bun --bun run your-script.ts
// 如果報錯，先用 node 運行，等 Bun 修復
```

## 實際使用建議

**可以用 Bun 的場景：**
- 新的 API 服務（Hono / Elysia）
- CLI 工具
- 腳本和自動化
- 開發環境（裝依賴、跑測試）
- 構建工具

**暫時不要用 Bun 的場景：**
- 大型生產 Node.js 應用
- 依賴特定 Node.js C++ Addon 的項目
- 需要完全 Node.js 相容性的企業環境

## 我的使用方式

```jsonc
// package.json
{
  "scripts": {
    // 開發時用 Bun（快）
    "dev": "bun run dev:internal",
    "test": "bun test",
    "install": "bun install",
    // 生產部署暫用 Node（穩）
    "start": "node dist/index.js"
  }
}
```

開發階段用 Bun 加速，生產環境暫時還是用 Node.js。等 Bun 的兼容性和穩定性再成熟一些再切。

## 小結

- Bun 的性能優勢是真實的：包安裝、腳本執行、HTTP 服務都明顯更快
- 內置測試運行器、打包器、包管理器，一站式體驗好
- Node.js 兼容性是最大短板，但改善速度很快
- 適合新項目和開發環境，大型生產項目暫時觀望
- Bun vs Deno vs Node 的三方競爭對整個 JS 生態是好事