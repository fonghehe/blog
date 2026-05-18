---
title: "Node.js 安全最佳實踐：常見漏洞與防禦策略"
date: 2019-05-03 15:56:46
tags:
  - Node.js
readingTime: 1
description: "Node.js 工程師很容易掉入安全陷阱——不是因為能力不夠，而是沒關注。本文整理了開發過程中常被忽視的安全日常實踐。"
---

Node.js 工程師很容易掉入安全陷阱——不是因為能力不夠，而是沒關注。本文整理了開發過程中常被忽視的安全日常實踐。

## Helmet ：HTTP 頭安全加固

```javascript
const express = require("express");
const helmet = require("helmet");

const app = express();

// 一行覆蓋大量安全頭
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

// 登入介面限流
// 同一 IP 15 分鐘內最多嘗試 10 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "登入嘗試過於頻繁，請 15 分鐘後重試" },
  standardHeaders: true,
});
app.post("/auth/login", loginLimiter, loginController);

// 全域性 API 限流
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use("/api/", apiLimiter);
```

## 防止 SQL 注入

```javascript
// ❌ 危險：拼接 SQL
const query = `SELECT * FROM users WHERE name = '${username}'`;
// username = "'; DROP TABLE users; --"

// ✅ 安全：引數化查詢
const [rows] = await db.execute(
  "SELECT * FROM users WHERE name = ? AND status = ?",
  [username, "active"],
);

// 使用 ORM（Sequelize）同樣安全
const user = await User.findOne({
  where: { name: username },
  // Sequelize 自動引數化
});
```

## 璯境變數和密鍛管理

```javascript
// ❌ 將密鍛硬編碼在程式碼裡
const JWT_SECRET = "my-super-secret-key"; // 絕對禁止

// ✅ 璯境變數
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
```

```bash
# .env （加入 .gitignore！）
JWT_SECRET=a-very-long-random-secret-at-least-32-chars
DB_PASSWORD=strong-random-password
```

## npm audit 與依賴安全

```bash
# 掃描已知漏洞
npm audit

# 自動修復低風險漏洞
npm audit fix

# 檢視無維護的依賴
npx depcheck
```

建議在 CI 中加入：

```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

## 輸入驗證與 XSS 防禦

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

## 總結

安全沒有附加操作，它是基礎工程體系的一部分。Helmet + 限流 + 引數化查詢 + 密鍛璯境變數 這四項是每個 Node.js 服務的標配，旨在攔截 80% 的常見攻擊。
