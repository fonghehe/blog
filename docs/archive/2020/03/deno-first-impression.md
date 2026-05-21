---
title: "Deno 初体验：下一代 Node.js？"
date: 2020-03-10 17:20:21
tags:
  - Node.js
readingTime: 2
description: "Node.js 之父 Ryan Dahl 在 2018 年 JSConf 上批评了 Node.js 的十大设计遗憾，随后宣布了 Deno 项目。现在 Deno 已经进入候选版本阶段，是时候体验一下了。"
wordCount: 292
---

Node.js 之父 Ryan Dahl 在 2018 年 JSConf 上批评了 Node.js 的十大设计遗憾，随后宣布了 Deno 项目。现在 Deno 已经进入候选版本阶段，是时候体验一下了。

## Deno 解决了 Node.js 的哪些问题

Ryan Dahl 总结的 Node.js 十大遗憾中，Deno 重点解决：

1. **安全性**：Node.js 默认可以访问所有系统资源，Deno 默认沙箱隔离
2. **模块系统**：不使用 `node_modules`，直接通过 URL 导入
3. **TypeScript 支持**：内置 TypeScript 编译器
4. **去中心化**：不需要 npm registry

## 快速上手

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

## 权限系统

这是 Deno 最大的安全创新：

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

## URL 导入模块

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

## 与 Node.js 的 API 对比

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

## 现阶段的局限

```typescript
// 1. 生态系统：npm 有 100 万+ 包，Deno 还很少
// 2. 兼容层尚不成熟
import * as path from 'https://deno.land/std/path/mod.ts';

// 3. 企业采用：几乎没有生产案例
// 4. 工具链：调试、IDE 支持不如 Node.js
// 5. 原生模块：C++ addon 不支持
```

## 适合什么场景

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

## 小结

- Deno 在安全性、TypeScript 支持、模块系统上确实改进了 Node.js 的痛点
- 权限系统是最大亮点，默认最小权限原则
- URL 导入省去了 node_modules，但也带来了网络依赖问题
- 目前生态和工具链还不成熟，适合尝鲜和工具脚本，不适合生产项目
- 持续关注，1.0 正式发布后再评估是否引入
