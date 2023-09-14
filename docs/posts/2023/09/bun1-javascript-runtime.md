---
title: "Bun 1.0：JavaScript 运行时的新选择"
date: 2023-09-14 16:06:05
tags:
  - JavaScript
---

Bun 1.0 正式发布！这是用 Zig 写的 JavaScript 运行时，声称比 Node.js 快很多。来看看是否值得切换。

## Bun 是什么

Bun 是 Node.js 的竞争者，但它不只是运行时：

- **Runtime**：运行 JS/TS（比 Node.js 快）
- **Package Manager**：替代 npm/pnpm（安装速度极快）
- **Bundler**：替代 esbuild（类似功能）
- **Test Runner**：替代 Jest（兼容 Jest API）

一个工具，解决多个问题。

## 速度对比

```bash
# 安装速度对比（安装 React + TypeScript 项目依赖）
npm install          # ~30s
pnpm install         # ~15s
bun install          # ~2s   ← 10-15x 更快

# 启动速度
node server.js       # ~200ms
bun server.ts        # ~10ms   ← 直接运行 TypeScript！
```

## 使用 Bun

```bash
# 安装
curl -fsSL https://bun.sh/install | bash

# 直接运行 TypeScript（无需 ts-node）
bun run server.ts

# 包管理（兼容 npm）
bun install
bun add react
bun remove lodash
bun update

# 内置测试运行器
bun test
```

## Bun API

```typescript
// server.ts：内置 HTTP 服务器
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/users") {
      return Response.json({ users: ["Alice", "Bob"] });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Running at http://localhost:${server.port}`);

// 文件操作
const file = Bun.file("./data.json");
const data = await file.json();

await Bun.write("./output.txt", JSON.stringify(data));

// SQLite（内置！）
import { Database } from "bun:sqlite";

const db = new Database(":memory:");
db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
db.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);

const users = db.query("SELECT * FROM users").all();
console.log(users); // [{ id: 1, name: 'Alice' }]
```

## 兼容性

```typescript
// Bun 目标是 Node.js 兼容，大部分 Node.js 代码可以直接跑
// 支持 Node.js API：fs, path, http, crypto, buffer...

// Express 也可以用
import express from "express";
const app = express();
app.get("/", (req, res) => res.send("Hello"));
app.listen(3000);

// bun run app.ts → 直接运行，不需要改代码
```

## 应该切换吗？（2023 年 9 月的判断）

**可以用 Bun 的场景：**

- 个人项目、脚本、工具
- 用 `bun install` 替代 npm（向下兼容，风险低）
- 内部工具

**暂时观望的场景：**

- 生产服务：生态还不够成熟，Edge cases 多
- 大型项目：迁移成本高，稳定性未验证
- 依赖很多 Node.js 特有包的项目

我的建议：**用 `bun install` 替代 npm 是最低风险的尝试**，安装速度提升明显，兼容性几乎完美。

## 小结

- Bun 是运行时 + 包管理 + 打包 + 测试的 all-in-one 工具
- 速度显著快于 Node.js 和 npm（5-20x）
- 内置 TypeScript 支持，无需 ts-node
- SQLite、文件操作 API 比 Node.js 更简洁
- 1.0 正式版，可以在非关键场景使用