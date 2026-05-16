---
title: "Deno 1.0 Released: Is It Ready to Use?"
date: 2020-05-12 16:31:31
tags:
  - Node.js
readingTime: 2
description: "Deno 1.0 终于发布了。作为 Node.js 之父 Ryan Dahl 的\"第二次尝试\"，它修正了 Node.js 的十大设计遗憾。在 1.0 之际，认真评估一下它到底适不适合在项目中使用。"
---

Deno 1.0 终于发布了。作为 Node.js 之父 Ryan Dahl 的"第二次尝试"，它修正了 Node.js 的十大设计遗憾。在 1.0 之际，认真评估一下它到底适不适合在项目中使用。

## Deno's Core Selling Points

```typescript
// 1. 安全：默认沙箱，需要显式授权
// 运行这个脚本会报错
const text = await Deno.readTextFile('/etc/hosts');
// error: Uncaught PermissionDenied

// 需要 --allow-read
deno run --allow-read script.ts

// 2. TypeScript 原生支持
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `你好 ${user.name}，你 ${user.age} 岁了`;
}

console.log(greet({ name: '张三', age: 28 }));
// 直接运行，不需要 tsconfig.json
// deno run greet.ts

// 3. 标准库
import { serve } from 'https://deno.land/std@0.50.0/http/server.ts';
import { readJson } from 'https://deno.land/std@0.50.0/fs/read_json.ts';
```

## Detailed Comparison with Node.js

```markdown
| 特性         | Node.js              | Deno                 |
|-------------|----------------------|----------------------|
| 语言         | JavaScript           | TypeScript 原生      |
| 模块系统     | CommonJS + node_modules | ES Modules + URL  |
| 包管理       | npm / yarn           | URL 直接导入         |
| 安全模型     | 无限制               | 沙箱 + 显式授权       |
| 异步         | Callback → Promise   | 原生 async/await     |
| 标准库       | 无（依赖 npm）        | 内置标准库           |
| 工具链       | 需要额外配置          | 内置 test/lint/format |
| TypeScript   | 需要 ts-node         | 原生支持             |
```

## 内置工具链

```bash
# 测试
deno test

# 代码检查
deno lint

# 格式化
deno fmt

# 文档生成
deno doc

# 依赖树
deno info script.ts
```

```typescript
// Deno.test 内置测试框架
Deno.test('加法测试', () => {
  const result = 1 + 2;
  if (result !== 3) {
    throw new Error('1 + 2 应该等于 3');
  }
});

Deno.test('异步测试', async () => {
  const response = await fetch('https://httpbin.org/get');
  const data = await response.json();
  console.assert(data.url === 'https://httpbin.org/get');
});
```

## 实际写一个小服务

```typescript
// server.ts
import { Application, Router } from 'https://deno.land/x/oak@v5.0.0/mod.ts';

const app = new Application();
const router = new Router();

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

let todos: Todo[] = [];
let nextId = 1;

router
  .get('/api/todos', (ctx) => {
    ctx.response.body = todos;
  })
  .post('/api/todos', async (ctx) => {
    const body = await ctx.request.body();
    const todo: Todo = {
      id: nextId++,
      title: body.value.title,
      completed: false,
    };
    todos.push(todo);
    ctx.response.status = 201;
    ctx.response.body = todo;
  })
  .delete('/api/todos/:id', (ctx) => {
    const id = Number(ctx.params.id);
    todos = todos.filter(t => t.id !== id);
    ctx.response.status = 204;
  });

app.use(router.routes());
app.use(router.allowedMethods());

console.log('服务器运行在 http://localhost:8000');
await app.listen({ port: 8000 });
```

```bash
deno run --allow-net server.ts
```

## 现阶段的实际问题

```markdown
1. 生态太小：npm 有 130 万个包，Deno 的第三方模块很少
2. 企业支持：没有大公司在生产环境使用
3. 兼容性：很多 npm 包无法直接使用
4. IDE 支持：VSCode 插件还在早期
5. 部署方案：没有 PM2 这样的进程管理
6. 调试：Chrome DevTools 支持有，但体验不如 Node.js
```

## 什么时候可以考虑用 Deno

```markdown
适合：
- 个人工具脚本（替代 Python/Shell）
- 小型 API 服务
- 技术预研和学习
- CLI 工具

暂时不适合：
- 企业级项目
- 需要大量 npm 依赖的项目
- 性能关键的后端服务
- 需要 C++ addon 的项目
```

## Summary

- Deno 1.0 在安全性和开发体验上确实比 Node.js 更好
- 内置 TypeScript、测试、lint、格式化，开箱即用
- URL 导入去掉了 node_modules，但也带来了版本管理问题
- 生态系统是最大短板，npm 生态不是一两年能追上的
- 2020 年可以在工具脚本中使用，生产项目还是用 Node.js
