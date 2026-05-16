---
title: "Frontend Mock Data Solutions Compared"
date: 2018-09-17 10:58:04
tags:
  - Frontend
readingTime: 2
description: "When frontend and backend are developed in parallel, the frontend needs mock data. Here's a comparison of several approaches I've used."
---

When frontend and backend are developed in parallel, the frontend needs mock data. Here's a comparison of several approaches I've used.

## Solution 1: Hardcoded in Code (Simplest, Worst)

```javascript
// ❌ Hard-coded data scattered everywhere, difficult to maintain
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

## Solution 2: Local JSON Files

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

Simple, but can't simulate delays or errors.

## Solution 3: Mock.js

Mock.js generates random data and intercepts XMLHttpRequest:

```javascript
// npm install mockjs

import Mock from "mockjs";

// Intercept GET /api/users and return random data
Mock.mock("/api/users", "get", {
  code: 0,
  "data|10": [
    {
      // Generate 10 records
      "id|+1": 1, // Auto-incrementing id
      name: "@name", // Random name
      email: "@email", // Random email
      "age|18-60": 1, // Random integer 18-60
      avatar: '@image("100x100")',
    },
  ],
});

// Regex URL matching
Mock.mock(/\/api\/users\/\d+/, "get", {
  code: 0,
  data: {
    id: "@id",
    name: "@name",
    email: "@email",
  },
});
```

## Solution 4: JSON Server

Standalone REST API service that reads a JSON file and supports full CRUD:

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

# Start (port 3000)
json-server --watch db.json --port 3000
```

Automatically generates:

- `GET /users` → get list
- `GET /users/1` → get single
- `POST /users` → create
- `PUT /users/1` → update
- `DELETE /users/1` → delete

Then proxy to it in `devServer.proxy`.

## Solution 5: MSW (Mock Service Worker)

A newer approach that intercepts requests at the browser layer via Service Worker:

```javascript
// src/mocks/handlers.js
import { rest } from "msw";

export const handlers = [
  rest.get("/api/users", (req, res, ctx) => {
    return res(
      ctx.delay(200), // Simulate delay
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

Advantage: no changes to business code, real network requests, visible in DevTools Network.

## Comparison

| Solution    | Difficulty | Random Data | Simulate Delay/Error | Code Change        |
| ----------- | ---------- | ----------- | -------------------- | ------------------ |
| Hardcoded   | Trivial    | ❌          | ❌                   | Yes                |
| JSON File   | Simple     | ❌          | ❌                   | Yes                |
| Mock.js     | Moderate   | ✅          | Limited              | No (XHR intercept) |
| JSON Server | Moderate   | ❌          | ❌                   | No (proxy)         |
| MSW         | Moderate   | ✅          | ✅                   | No                 |

## Summary

- Small projects: Mock.js with random data is sufficient
- Aligning with backend data structures: JSON Server
- Unit/integration testing: MSW is best practice
- Regardless of approach, mock code should not make it into production builds (tree-shaking or conditional loading)
