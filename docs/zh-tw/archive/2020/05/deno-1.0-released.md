---
title: "Deno 1.0 正式釋出，現在能用了嗎？"
date: 2020-05-12 16:31:31
tags:
  - Node.js
readingTime: 2
description: "Deno 1.0 終於釋出了。作為 Node.js 之父 Ryan Dahl 的\"第二次嘗試\"，它修正了 Node.js 的十大設計遺憾。在 1.0 之際，認真評估一下它到底適不適合在專案中使用。"
---

Deno 1.0 終於釋出了。作為 Node.js 之父 Ryan Dahl 的"第二次嘗試"，它修正了 Node.js 的十大設計遺憾。在 1.0 之際，認真評估一下它到底適不適合在專案中使用。

## Deno 的核心賣點

```typescript
// 1. 安全：預設沙箱，需要顯式授權
// 執行這個指令碼會報錯
const text = await Deno.readTextFile('/etc/hosts');
// error: Uncaught PermissionDenied

// 需要 --allow-read
deno run --allow-read script.ts

// 2. TypeScript 原生支援
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `你好 ${user.name}，你 ${user.age} 歲了`;
}

console.log(greet({ name: '張三', age: 28 }));
// 直接執行，不需要 tsconfig.json
// deno run greet.ts

// 3. 標準庫
import { serve } from 'https://deno.land/std@0.50.0/http/server.ts';
import { readJson } from 'https://deno.land/std@0.50.0/fs/read_json.ts';
```

## 和 Node.js 的詳細對比

```markdown
| 特性         | Node.js              | Deno                 |
|
-------------|----------------------|----------------------|
| 語言         | JavaScript           | TypeScript 原生      |
| 模組系統     | CommonJS + node_modules | ES Modules + URL  |
| 包管理       | npm / yarn           | URL 直接匯入         |
| 安全模型     | 無限制               | 沙箱 + 顯式授權       |
| 非同步         | Callback → Promise   | 原生 async/await     |
| 標準庫       | 無（依賴 npm）        | 內建標準庫           |
| 工具鏈       | 需要額外配置          | 內建 test/lint/format |
| TypeScript   | 需要 ts-node         | 原生支援             |
```

## 內建工具鏈

```bash
# 測試
deno test

# 程式碼檢查
deno lint

# 格式化
deno fmt

# 文件生成
deno doc

# 依賴樹
deno info script.ts
```

```typescript
// Deno.test 內建測試框架
Deno.test('加法測試', () => {
  const result = 1 + 2;
  if (result !== 3) {
    throw new Error('1 + 2 應該等於 3');
  }
});

Deno.test('非同步測試', async () => {
  const response = await fetch('https://httpbin.org/get');
  const data = await response.json();
  console.assert(data.url === 'https://httpbin.org/get');
});
```

## 實際寫一個小服務

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

console.log('伺服器執行在 http://localhost:8000');
await app.listen({ port: 8000 });
```

```bash
deno run --allow-net server.ts
```

## 現階段的實際問題

```markdown
1. 生態太小：npm 有 130 萬個包，Deno 的第三方模組很少
2. 企業支援：沒有大公司在生產環境使用
3. 相容性：很多 npm 包無法直接使用
4. IDE 支援：VSCode 外掛還在早期
5. 部署方案：沒有 PM2 這樣的程序管理
6. 除錯：Chrome DevTools 支援有，但體驗不如 Node.js
```

## 什麼時候可以考慮用 Deno

```markdown
適合：
- 個人工具指令碼（替代 Python/Shell）
- 小型 API 服務
- 技術預研和學習
- CLI 工具

暫時不適合：
- 企業級專案
- 需要大量 npm 依賴的專案
- 效能關鍵的後端服務
- 需要 C++ addon 的專案
```

## 小結

- Deno 1.0 在安全性和開發體驗上確實比 Node.js 更好
- 內建 TypeScript、測試、lint、格式化，開箱即用
- URL 匯入去掉了 node_modules，但也帶來了版本管理問題
- 生態系統是最大短板，npm 生態不是一兩年能追上的
- 2020 年可以在工具指令碼中使用，生產專案還是用 Node.js
