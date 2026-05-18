---
title: "Deno 1.x 實踐：從 Node.js 到更安全的運行時"
date: 2022-10-25 09:48:31
tags:
  - Deno
readingTime: 2
description: "Deno 從 1.0 發佈到現在已經兩年了。1.2x 版本的生態逐漸成熟，Deno Deploy 讓它有了實際的部署場景。這篇文章講講 Deno 的核心理念和實際使用體驗。"
---

Deno 從 1.0 發佈到現在已經兩年了。1.2x 版本的生態逐漸成熟，Deno Deploy 讓它有了實際的部署場景。這篇文章講講 Deno 的核心理念和實際使用體驗。

## 核心理念

Deno 和 Node.js 的設計差異：

| 特性 | Node.js | Deno |
|
------|---------|------|
| 安全模型 | 信任所有代碼 | 默認沙箱，需顯式授權 |
| 模塊系統 | CommonJS + ESM | 純 ESM（URL 導入） |
| TypeScript | 需要編譯 | 原生支持 |
| 標準庫 | 需要 npm 包 | deno.land/std 標準庫 |
| 工具鏈 | 分散（npm + ts-node + eslint + jest） | 內置（格式化 + lint + 測試） |

## 基礎用法

```typescript
// hello.ts
const greeting = (name: string): string => `Hello, ${name}!`;

console.log(greeting('Deno'));
```

```bash
# 直接運行 TypeScript
deno run hello.ts

# 帶權限
deno run --allow-net --allow-read server.ts
```

## URL 導入

```typescript
// 從 URL 導入，不需要 npm install
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import { oak } from 'https://deno.land/x/oak@v11.1.0/mod.ts';

// 也可以用 npm: 協議（Deno 1.28+）
import express from 'npm:express@4.18.2';
```

## HTTP 服務器

```typescript
// server.ts
import { Application, Router } from 'https://deno.land/x/oak@v11.1.0/mod.ts';

const app = new Application();
const router = new Router();

router
  .get('/api/hello', (ctx) => {
    ctx.response.body = { message: 'Hello from Deno!' };
  })
  .get('/api/users/:id', async (ctx) => {
    const { id } = ctx.params;
    const user = await getUser(id);
    ctx.response.body = user;
  });

app.use(router.routes());
app.use(router.allowedMethods());

console.log('Server running on http://localhost:8000');
await app.listen({ port: 8000 });
```

```bash
deno run --allow-net --allow-read server.ts
```

## 權限系統

```typescript
// 讀文件需要 --allow-read
const data = await Deno.readTextFile('./config.json');

// 寫文件需要 --allow-write
await Deno.writeTextFile('./output.txt', data);

// 網絡請求需要 --allow-net
const res = await fetch('https://api.example.com');

// 環境變量需要 --allow-env
const port = Deno.env.get('PORT') || '8000';

// 細粒度權限
// --allow-read=/tmp（只允許讀 /tmp）
// --allow-net=api.example.com（只允許訪問特定域名）
```

## 內置工具

```bash
# 格式化
deno fmt src/

# Lint
deno lint src/

# 測試
deno test

# 打包
deno bundle mod.ts dist/bundle.js

# 文檔生成
deno doc mod.ts
```

```typescript
// math.test.ts
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';
import { add, multiply } from './math.ts';

Deno.test('加法', () => {
  assertEquals(add(1, 2), 3);
});

Deno.test('乘法', () => {
  assertEquals(multiply(3, 4), 12);
});

Deno.test('異步測試', async () => {
  const result = await asyncAdd(1, 2);
  assertEquals(result, 3);
});
```

## 標準庫

```typescript
// 路徑處理
import { join, extname } from 'https://deno.land/std@0.170.0/path/mod.ts';

const filePath = join('src', 'components', 'Button.tsx');
console.log(extname(filePath)); // .tsx

// 加密
import { crypto } from 'https://deno.land/std@0.170.0/crypto/mod.ts';

const hash = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode('hello')
);
console.log(new Uint8Array(hash));

// 環境變量
import { config } from 'https://deno.land/std@0.170.0/dotenv/mod.ts';

const env = await config();
console.log(env.DATABASE_URL);

// HTTP 工具
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';

serve((req) => new Response('Hello!'), { port: 8000 });
```

## Deno Deploy（邊緣部署）

```typescript
// deploy.ts — 部署到 Deno Deploy
addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/time') {
    return Response.json({
      time: new Date().toISOString(),
      region: Deno.env.get('DENO_REGION'),
    });
  }

  return new Response('Not Found', { status: 404 });
}
```

Deno Deploy 提供全球邊緣網絡，類似 Cloudflare Workers。

## 現實問題

1. **生態不夠成熟**：很多 npm 包在 Deno 上不能直接跑
2. **企業採用少**：生產環境很少用 Deno
3. **Deno.land 不穩定**：依賴 URL 導入，版本管理不如 npm 方便

```typescript
// 解決方案：用 import_map 管理依賴
// deno.json
{
  "imports": {
    "oak/": "https://deno.land/x/oak@v11.1.0/",
    "std/": "https://deno.land/std@0.170.0/"
  }
}
```

## 小結

Deno 的理念是正確的——安全、TypeScript 原生、內置工具鏈。但 Node.js 的生態護城河太深，Deno 更適合作為特定場景（邊緣計算、CLI 工具、安全敏感應用）的選擇。2022 年的 Deno 適合體驗和實驗，不適合替代 Node.js。