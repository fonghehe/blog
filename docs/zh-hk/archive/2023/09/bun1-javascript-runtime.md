---
title: "Bun 1.0：JavaScript 運行時的新選擇"
date: 2023-09-14 16:06:05
tags:
  - JavaScript
readingTime: 2
description: "Bun 1.0 正式發佈！這是用 Zig 寫的 JavaScript 運行時，聲稱比 Node.js 快很多。來看看是否值得切換。"
wordCount: 310
---

Bun 1.0 正式發佈！這是用 Zig 寫的 JavaScript 運行時，聲稱比 Node.js 快很多。來看看是否值得切換。

## Bun 是什麼

Bun 是 Node.js 的競爭者，但它不隻是運行時：

- **Runtime**：運行 JS/TS（比 Node.js 快）
- **Package Manager**：替代 npm/pnpm（安裝速度極快）
- **Bundler**：替代 esbuild（類似功能）
- **Test Runner**：替代 Jest（兼容 Jest API）

一個工具，解決多個問題。

## 速度對比

```bash
# 安裝速度對比（安裝 React + TypeScript 項目依賴）
npm install          # ~30s
pnpm install         # ~15s
bun install          # ~2s   ← 10-15x 更快

# 啓動速度
node server.js       # ~200ms
bun server.ts        # ~10ms   ← 直接運行 TypeScript！
```

## 使用 Bun

```bash
# 安裝
curl -fsSL https://bun.sh/install | bash

# 直接運行 TypeScript（無需 ts-node）
bun run server.ts

# 包管理（相容 npm）
bun install
bun add react
bun remove lodash
bun update

# 內置測試運行器
bun test
```

## Bun API

```typescript
// server.ts：內置 HTTP 服務器
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

// SQLite（內置！）
import { Database } from "bun:sqlite";

const db = new Database(":memory:");
db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
db.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);

const users = db.query("SELECT * FROM users").all();
console.log(users); // [{ id: 1, name: 'Alice' }]
```

## 相容性

```typescript
// Bun 目標是 Node.js 兼容，大部分 Node.js 代碼可以直接跑
// 支持 Node.js API：fs, path, http, crypto, buffer...

// Express 也可以用
import express from "express";
const app = express();
app.get("/", (req, res) => res.send("Hello"));
app.listen(3000);

// bun run app.ts → 直接運行，不需要改代碼
```

## 應該切換嗎？（2023 年 9 月的判斷）

**可以用 Bun 的場景：**

- 個人項目、腳本、工具
- 用 `bun install` 替代 npm（向下兼容，風險低）
- 內部工具

**暫時觀望的場景：**

- 生產服務：生態還不夠成熟，Edge cases 多
- 大型項目：遷移成本高，穩定性未驗證
- 依賴很多 Node.js 特有包的項目

我的建議：**用 `bun install` 替代 npm 是最低風險的嘗試**，安裝速度提升明顯，兼容性幾乎完美。

## 小結

- Bun 是運行時 + 包管理 + 打包 + 測試的 all-in-one 工具
- 速度顯著快於 Node.js 和 npm（5-20x）
- 內置 TypeScript 支援，無需 ts-node
- SQLite、文件操作 API 比 Node.js 更簡潔
- 1.0 正式版，可以在非關鍵場景使用