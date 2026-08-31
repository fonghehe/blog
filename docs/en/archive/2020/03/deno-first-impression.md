---
title: "First Look at Deno: The Next-Generation Node.js?"
date: 2020-03-10 17:20:21
tags:
  - Node.js
readingTime: 2
description: "Node.js creator Ryan Dahl criticized Node.js's ten design regrets at JSConf 2018 and then announced Deno. Now that Deno has reached its release candidate stage, it's time to give it a try."
wordCount: 186
---

Ryan Dahl, the creator of Node.js, criticized Node.js's ten "design regrets" at JSConf 2018 and then announced the Deno project. Deno has now reached its release candidate stage, so it's time to give it a try.

## What Problems Deno Solves with Node.js

Of the ten regrets Ryan Dahl summarized about Node.js, Deno mainly addresses:

1. **Security**: Node.js can access all system resources by default, while Deno sandboxes by default.
2. **Module system**: No `node_modules`; modules are imported directly via URL.
3. **TypeScript support**: A TypeScript compiler is built in.
4. **Decentralization**: No npm registry required.

## Quick Start

```bash
# 安装（macOS）
curl -fsSL https://deno.land/x/install/install.sh | sh

# 验证
deno --version
```

```typescript
// hello.ts —— 直接写 TypeScript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet('Deno'));
```

```bash
# 直接运行，不需要编译步骤
deno run hello.ts
```

## Permission System

This is Deno's biggest security innovation:

```typescript
// file.ts
const data = await Deno.readFile('/etc/hosts');
console.log(new TextDecoder().decode(data));
```

```bash
# 默认拒绝访问！必须显式授权
deno run file.ts
# error: Uncaught PermissionDenied: read access to "/etc/hosts"

# 授权读取
deno run --allow-read file.ts

# 只授权读取特定目录
deno run --allow-read=/tmp file.ts

# 网络权限
deno run --allow-net=api.example.com server.ts

# 完全权限（不推荐）
deno run --allow-all file.ts
```

## Importing Modules via URL

```typescript
// 不需要 npm install，直接导入
import { serve } from 'https://deno.land/std@0.50.0/http/server.ts';

const server = serve({ port: 8000 });
console.log('http://localhost:8000/');

for await (const req of server) {
  req.respond({ body: 'Hello Deno!\n' });
}
```

```bash
# 运行需要网络权限
deno run --allow-net server.ts

# 第一次运行时下载依赖，之后有缓存
```

## API Comparison with Node.js

```typescript
// 文件操作
// Node.js
import { readFile } from 'fs/promises';
const content = await readFile('data.txt', 'utf-8');

// Deno
const content = await Deno.readTextFile('data.txt');

// HTTP 服务器
// Node.js (Express)
import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Hello'));
app.listen(3000);

// Deno (Oak，类似 Koa)
import { Application } from 'https://deno.land/x/oak/mod.ts';
const app = new Application();
app.use(ctx => {
  ctx.response.body = 'Hello';
});
await app.listen({ port: 3000 });
```

## Current Limitations

```typescript
// 1. 生态系统：npm 有 100 万+ 包，Deno 还很少
// 2. 兼容层尚不成熟
import * as path from 'https://deno.land/std/path/mod.ts';

// 3. 企业采用：几乎没有生产案例
// 4. 工具链：调试、IDE 支持不如 Node.js
// 5. 原生模块：C++ addon 不支持
```

## When to Use It

```markdown
现在适合：
- 脚本和工具（替代 shell 脚本）
- 小型 API 服务
- 技术探索和学习

暂时不适合：
- 企业级生产项目
- 需要大量 npm 包的项目
- 性能关键的后端服务
```

## Summary

- Deno genuinely improves on Node.js's pain points in security, TypeScript support, and the module system.
- The permission system is the standout feature, following least-privilege by default.
- URL imports remove the need for node_modules, but introduce a network dependency.
- The ecosystem and tooling aren't mature yet—good for experimentation and utility scripts, but not for production.
- I'll keep watching and re-evaluate whether to adopt it once 1.0 ships.
