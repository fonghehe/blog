---
title: "前端 Mock 數據方案對比：落地路徑與實戰建議"
date: 2018-09-17 10:58:04
tags:
  - 前端
readingTime: 2
description: "前後端並行開發時，前端需要 Mock 數據。用過好幾種方案，整理一下各自的優缺點。"
wordCount: 360
---

前後端並行開發時，前端需要 Mock 數據。用過好幾種方案，整理一下各自的優缺點。

## 方案一：硬編碼在代碼裏（最簡單，最差）

```javascript
// ❌ 到處是寫死的數據，難以維護
async function getUsers() {
  if (process.env.NODE_ENV === "development") {
    return [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
  }
  return fetch("/api/users").then((r) => r.json());
}
```

## 方案二：本地 JSON 檔案

```javascript
// mock/users.json
// src/api/index.js
import usersData from "@/mock/users.json";

async function getUsers() {
  if (process.env.VUE_APP_MOCK === "true") {
    return usersData;
  }
  return request.get("/api/users");
}
```

簡單，但無法模擬延遲和錯誤。

## 方案三：Mock.js

Mock.js 可以生成隨機數據，攔截 XMLHttpRequest：

```javascript
// npm install mockjs

import Mock from "mockjs";

// 攔截 GET /api/users，返回隨機數據
Mock.mock("/api/users", "get", {
  code: 0,
  "data|10": [
    {
      // 生成 10 條數據
      "id|+1": 1, // 自增 id
      name: "@cname", // 隨機中文名
      email: "@email", // 隨機郵箱
      "age|18-60": 1, // 18-60 隨機整數
      avatar: '@image("100x100")',
    },
  ],
});

// 支持正則匹配 URL
Mock.mock(/\/api\/users\/\d+/, "get", {
  code: 0,
  data: {
    id: "@id",
    name: "@cname",
    email: "@email",
  },
});
```

## 方案四：JSON Server

獨立的 REST API 服務，讀取 JSON 文件，支持 CRUD：

```bash
npm install -g json-server

# db.json
{
  "users": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" }
  ],
  "posts": []
}

# 啓動（端口 3000）
json-server --watch db.json --port 3000
```

自動生成：

- `GET /users` → 獲取列表
- `GET /users/1` → 獲取單條
- `POST /users` → 創建
- `PUT /users/1` → 更新
- `DELETE /users/1` → 刪除

然後在 devServer.proxy 裏代理到它。

## 方案五：MSW（Mock Service Worker）

2018 年剛出現的新方案，通過 Service Worker 在瀏覽器層攔截請求：

```javascript
// src/mocks/handlers.js
import { rest } from "msw";

export const handlers = [
  rest.get("/api/users", (req, res, ctx) => {
    return res(
      ctx.delay(200), // 模擬延遲
      ctx.json({
        code: 0,
        data: [{ id: 1, name: "Alice" }],
      }),
    );
  }),

  rest.post("/api/users", (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({ code: 0, data: { id: 3, ...req.body } }),
    );
  }),
];
```

優點：不需要修改業務代碼，真實的網絡請求，DevTools Network 可以看到。

## 對比

| 方案        | 難度 | 隨機數據 | 模擬延遲/錯誤 | 修改代碼       |
| 
----------- | ---- | -------- | ------------- | -------------- |
| 硬編碼      | 極簡 | ❌       | ❌            | 是             |
| JSON 文件   | 簡單 | ❌       | ❌            | 是             |
| Mock.js     | 中等 | ✅       | 有限          | 否（XHR 攔截） |
| JSON Server | 中等 | ❌       | ❌            | 否（代理）     |
| MSW         | 中等 | ✅       | ✅            | 否             |

## 我們的做法

在 `vue.config.js` 裏，開發環境根據環境變量決定是否啓用 Mock.js：

```javascript
// 隻在開發環境加載 mock
if (process.env.VUE_APP_MOCK === "true") {
  require("./src/mock");
}
```

## 小結

- 小項目：Mock.js + 隨機數據夠用
- 需要和後端數據結構對齊：JSON Server
- 單元/集成測試：MSW 是最佳實踐
- 無論哪種方案，Mock 代碼不要進生產包（tree-shaking 或條件加載）
