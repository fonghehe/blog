---
title: "Deno 1.x 实践：从 Node.js 到更安全的运行时"
date: 2022-10-25 09:48:31
tags:
  - Deno
readingTime: 2
description: "Deno 从 1.0 发布到现在已经两年了。1.2x 版本的生态逐渐成熟，Deno Deploy 让它有了实际的部署场景。这篇文章讲讲 Deno 的核心理念和实际使用体验。"
---

Deno 从 1.0 发布到现在已经两年了。1.2x 版本的生态逐渐成熟，Deno Deploy 让它有了实际的部署场景。这篇文章讲讲 Deno 的核心理念和实际使用体验。

## 核心理念

Deno 和 Node.js 的设计差异：

| 特性 | Node.js | Deno |
|
------|---------|------|
| 安全模型 | 信任所有代码 | 默认沙箱，需显式授权 |
| 模块系统 | CommonJS + ESM | 纯 ESM（URL 导入） |
| TypeScript | 需要编译 | 原生支持 |
| 标准库 | 需要 npm 包 | deno.land/std 标准库 |
| 工具链 | 分散（npm + ts-node + eslint + jest） | 内置（格式化 + lint + 测试） |

## 基础用法

```typescript
// hello.ts
const greeting = (name: string): string => `Hello, ${name}!`;

console.log(greeting('Deno'));
```

```bash
# 直接运行 TypeScript
deno run hello.ts

# 带权限
deno run --allow-net --allow-read server.ts
```

## URL 导入

```typescript
// 从 URL 导入，不需要 npm install
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import { oak } from 'https://deno.land/x/oak@v11.1.0/mod.ts';

// 也可以用 npm: 协议（Deno 1.28+）
import express from 'npm:express@4.18.2';
```

## HTTP 服务器

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

## 权限系统

```typescript
// 读文件需要 --allow-read
const data = await Deno.readTextFile('./config.json');

// 写文件需要 --allow-write
await Deno.writeTextFile('./output.txt', data);

// 网络请求需要 --allow-net
const res = await fetch('https://api.example.com');

// 环境变量需要 --allow-env
const port = Deno.env.get('PORT') || '8000';

// 细粒度权限
// --allow-read=/tmp（只允许读 /tmp）
// --allow-net=api.example.com（只允许访问特定域名）
```

## 内置工具

```bash
# 格式化
deno fmt src/

# Lint
deno lint src/

# 测试
deno test

# 打包
deno bundle mod.ts dist/bundle.js

# 文档生成
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

Deno.test('异步测试', async () => {
  const result = await asyncAdd(1, 2);
  assertEquals(result, 3);
});
```

## 标准库

```typescript
// 路径处理
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

// 环境变量
import { config } from 'https://deno.land/std@0.170.0/dotenv/mod.ts';

const env = await config();
console.log(env.DATABASE_URL);

// HTTP 工具
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';

serve((req) => new Response('Hello!'), { port: 8000 });
```

## Deno Deploy（边缘部署）

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

Deno Deploy 提供全球边缘网络，类似 Cloudflare Workers。

## 现实问题

1. **生态不够成熟**：很多 npm 包在 Deno 上不能直接跑
2. **企业采用少**：生产环境很少用 Deno
3. **Deno.land 不稳定**：依赖 URL 导入，版本管理不如 npm 方便

```typescript
// 解决方案：用 import_map 管理依赖
// deno.json
{
  "imports": {
    "oak/": "https://deno.land/x/oak@v11.1.0/",
    "std/": "https://deno.land/std@0.170.0/"
  }
}
```

## 小结

Deno 的理念是正确的——安全、TypeScript 原生、内置工具链。但 Node.js 的生态护城河太深，Deno 更适合作为特定场景（边缘计算、CLI 工具、安全敏感应用）的选择。2022 年的 Deno 适合体验和实验，不适合替代 Node.js。