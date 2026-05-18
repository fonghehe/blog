---
title: "Node.js 安全最佳实践：常见漏洞与防御策略"
date: 2019-05-03 15:56:46
tags:
  - Node.js
readingTime: 1
description: "Node.js 工程师很容易掉入安全陷阱——不是因为能力不够，而是没关注。本文整理了开发过程中常被忽视的安全日常实践。"
---

Node.js 工程师很容易掉入安全陷阱——不是因为能力不够，而是没关注。本文整理了开发过程中常被忽视的安全日常实践。

## Helmet ：HTTP 头安全加固

```javascript
const express = require("express");
const helmet = require("helmet");

const app = express();

// 一行覆盖大量安全头
// X-Content-Type-Options, X-Frame-Options, HSTS, CSP 等
app.use(helmet());

// 或者按需配置
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "cdn.example.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  }),
);
```

## 限流防止暴力破解

```javascript
const rateLimit = require("express-rate-limit");

// 登录接口限流
// 同一 IP 15 分钟内最多尝试 10 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "登录尝试过于频繁，请 15 分钟后重试" },
  standardHeaders: true,
});
app.post("/auth/login", loginLimiter, loginController);

// 全局 API 限流
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use("/api/", apiLimiter);
```

## 防止 SQL 注入

```javascript
// ❌ 危险：拼接 SQL
const query = `SELECT * FROM users WHERE name = '${username}'`;
// username = "'; DROP TABLE users; --"

// ✅ 安全：参数化查询
const [rows] = await db.execute(
  "SELECT * FROM users WHERE name = ? AND status = ?",
  [username, "active"],
);

// 使用 ORM（Sequelize）同样安全
const user = await User.findOne({
  where: { name: username },
  // Sequelize 自动参数化
});
```

## 璯境变量和密锻管理

```javascript
// ❌ 将密锻硬编码在代码里
const JWT_SECRET = "my-super-secret-key"; // 绝对禁止

// ✅ 璯境变量
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
```

```bash
# .env （加入 .gitignore！）
JWT_SECRET=a-very-long-random-secret-at-least-32-chars
DB_PASSWORD=strong-random-password
```

## npm audit 与依赖安全

```bash
# 扫描已知漏洞
npm audit

# 自动修复低风险漏洞
npm audit fix

# 查看无维护的依赖
npx depcheck
```

建议在 CI 中加入：

```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

## 输入验证与 XSS 防御

```javascript
const { body, validationResult } = require("express-validator");

app.post(
  "/users",
  [
    body("email").isEmail().normalizeEmail(),
    body("name").trim().isLength({ min: 1, max: 50 }).escape(),
    body("age").isInt({ min: 0, max: 150 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ...
  },
);
```

## 总结

安全没有附加操作，它是基础工程体系的一部分。Helmet + 限流 + 参数化查询 + 密锻璯境变量 这四项是每个 Node.js 服务的标配，旨在拦截 80% 的常见攻击。
