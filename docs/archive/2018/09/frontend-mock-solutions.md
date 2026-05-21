---
title: "前端 Mock 数据方案对比"
date: 2018-09-17 10:58:04
tags:
  - 前端
readingTime: 2
description: "前后端并行开发时，前端需要 Mock 数据。用过好几种方案，整理一下各自的优缺点。"
wordCount: 360
---

前后端并行开发时，前端需要 Mock 数据。用过好几种方案，整理一下各自的优缺点。

## 方案一：硬编码在代码里（最简单，最差）

```javascript
// ❌ 到处是写死的数据，难以维护
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

## 方案二：本地 JSON 文件

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

简单，但无法模拟延迟和错误。

## 方案三：Mock.js

Mock.js 可以生成随机数据，拦截 XMLHttpRequest：

```javascript
// npm install mockjs

import Mock from "mockjs";

// 拦截 GET /api/users，返回随机数据
Mock.mock("/api/users", "get", {
  code: 0,
  "data|10": [
    {
      // 生成 10 条数据
      "id|+1": 1, // 自增 id
      name: "@cname", // 随机中文名
      email: "@email", // 随机邮箱
      "age|18-60": 1, // 18-60 随机整数
      avatar: '@image("100x100")',
    },
  ],
});

// 支持正则匹配 URL
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

独立的 REST API 服务，读取 JSON 文件，支持 CRUD：

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

# 启动（端口 3000）
json-server --watch db.json --port 3000
```

自动生成：

- `GET /users` → 获取列表
- `GET /users/1` → 获取单条
- `POST /users` → 创建
- `PUT /users/1` → 更新
- `DELETE /users/1` → 删除

然后在 devServer.proxy 里代理到它。

## 方案五：MSW（Mock Service Worker）

2018 年刚出现的新方案，通过 Service Worker 在浏览器层拦截请求：

```javascript
// src/mocks/handlers.js
import { rest } from "msw";

export const handlers = [
  rest.get("/api/users", (req, res, ctx) => {
    return res(
      ctx.delay(200), // 模拟延迟
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

优点：不需要修改业务代码，真实的网络请求，DevTools Network 可以看到。

## 对比

| 方案        | 难度 | 随机数据 | 模拟延迟/错误 | 修改代码       |
| 
----------- | ---- | -------- | ------------- | -------------- |
| 硬编码      | 极简 | ❌       | ❌            | 是             |
| JSON 文件   | 简单 | ❌       | ❌            | 是             |
| Mock.js     | 中等 | ✅       | 有限          | 否（XHR 拦截） |
| JSON Server | 中等 | ❌       | ❌            | 否（代理）     |
| MSW         | 中等 | ✅       | ✅            | 否             |

## 我们的做法

在 `vue.config.js` 里，开发环境根据环境变量决定是否启用 Mock.js：

```javascript
// 只在开发环境加载 mock
if (process.env.VUE_APP_MOCK === "true") {
  require("./src/mock");
}
```

## 小结

- 小项目：Mock.js + 随机数据够用
- 需要和后端数据结构对齐：JSON Server
- 单元/集成测试：MSW 是最佳实践
- 无论哪种方案，Mock 代码不要进生产包（tree-shaking 或条件加载）
