---
title: "Bun：JavaScript 運行時的新挑戰者"
date: 2022-07-26 10:22:05
tags:
  - 前端
readingTime: 2
description: "2022 年 7 月，Jarred Sumner 發佈了 Bun——一個用 Zig 編寫的 JavaScript 運行時。它的目標很激進：替代 Node.js、npm、esbuild、Jest，成為 JavaScript 工具鏈的統一解決方案。"
---

2022 年 7 月，Jarred Sumner 發佈了 Bun——一個用 Zig 編寫的 JavaScript 運行時。它的目標很激進：替代 Node.js、npm、esbuild、Jest，成為 JavaScript 工具鏈的統一解決方案。

## 安裝與基礎用法

```bash
# 安裝
curl -fsSL https://bun.sh/install | bash

# 驗證
bun --version
# 0.1.x（2022 年 7 月）

# 運行 TypeScript 文件（不需要編譯步驟）
bun run app.ts

# 運行 JSX/TSX
bun run App.tsx

# 包管理
bun install
bun add lodash
bun remove lodash
```

## 速度有多快

```bash
# 運行 TypeScript 腳本
time bun run script.ts
# 0.02s

time npx ts-node script.ts
# 1.8s

time node --loader ts-node/esm script.ts
# 2.1s
```

冷啓動快了 100 倍。這是因為 Bun 用 JavaScriptCore（Safari 的引擎）而不是 V8，並且用 Zig 寫了底層 IO。

## 作為包管理器

```bash
# 安裝依賴（比 pnpm 還快）
bun install

# 添加依賴
bun add react react-dom

# 查看安裝速度
time bun install
# node_modules: 0.3s

time pnpm install
# node_modules: 2.8s
```

Bun 使用硬鏈接 + 全局緩存（和 pnpm 類似），但實現更快。

## 內置的打包器

```typescript
// 直接打包
bun build ./src/index.ts --outdir ./dist

// 帶配置
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
  splitting: true, // 代碼分割
  target: 'browser',
  format: 'esm',
});
```

## 內置的測試運行器

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

// 運行
// bun test
```

Bun 的測試運行器兼容 Jest API，但快得多。

## HTTP 服務器

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
      // 流式響應
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

性能對比（簡單的 JSON 響應）：

```
Node.js (http):     ~50,000 req/s
Deno (oak):         ~80,000 req/s
Bun (Bun.serve):   ~250,000 req/s
```

## 文件 IO

```typescript
// 讀文件（比 Node.js 快 10x）
const file = Bun.file('data.json');
const data = await file.json();

// 寫文件
await Bun.write('output.txt', 'Hello, Bun!');

// 複製文件
const src = Bun.file('source.txt');
await Bun.write('dest.txt', src);

// 文件信息
console.log(file.size);     // 字節
console.log(file.type);     // MIME 類型
console.log(file.lastModified);
```

## 現實問題

2022 年 7 月的 Bun 還很早期：

1. **兼容性**：不是所有 npm 包都能跑，尤其是用了 Node.js 原生模塊的
2. **穩定性**：還在 0.x 版本，API 可能變化
3. **生態**：沒有社區插件和工具鏈
4. **Windows 支持**：2022 年還沒有

```bash
# 測試你的項目兼容性
bun install
bun test
# 大概率會遇到某些包不兼容
```

## 與 Node.js 和 Deno 的定位

| 特性 | Node.js | Deno | Bun |
|
------|---------|------|-----|
| 引擎 | V8 | V8 | JavaScriptCore |
| 語言 | C++ | Rust | Zig |
| TypeScript | 需要編譯 | 原生支持 | 原生支持 |
| 包管理 | npm/pnpm/yarn | URL 導入 | 內置 |
| 測試 | 需要框架 | 內置 | 內置 |
| 成熟度 | 生產就緒 | 較成熟 | 早期 |

## 小結

Bun 的方向是對的——統一 JavaScript 工具鏈，減少碎片化。2022 年的 Bun 還不適合生產環境，但它的速度表現令人印象深刻。關注它的發展，但別急着遷移。2023 年會是 Bun 關鍵的一年。