---
title: "Node.jsセキュリティベストプラクティス：一般的な脆弱性と防御策"
date: 2019-05-03 15:56:46
tags:
  - Node.js
readingTime: 1
description: "Node.jsエンジニアはセキュリティの落とし穴に陥りやすいです——能力不足ではなく、注意が向いていないからです。本記事では日々の開発でよく見落とされるセキュリティの実践をまとめます。"
wordCount: 208
---

Node.jsエンジニアはセキュリティの落とし穴に陥りやすいです——能力不足ではなく、注意が向いていないからです。本記事では日々の開発でよく見落とされるセキュリティの実践をまとめます。

## Helmet：HTTPヘッダーのセキュリティ強化

```javascript
const express = require("express");
const helmet = require("helmet");

const app = express();

// 1行で多くのセキュリティヘッダーをカバー：
// X-Content-Type-Options, X-Frame-Options, HSTS, CSPなど
app.use(helmet());

// または必要に応じて設定
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

## レート制限でブルートフォース攻撃を防止

```javascript
const rateLimit = require("express-rate-limit");

// ログインエンドポイントのレート制限：
// 同一IPが15分以内に最大10回まで試行可能
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "ログイン試行が多すぎます。15分後にもう一度お試しください。",
  },
  standardHeaders: true,
});
app.post("/auth/login", loginLimiter, loginController);

// グローバルAPIレート制限
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use("/api/", apiLimiter);
```

## SQLインジェクションの防止

```javascript
// ❌ 危険：文字列の連結
const query = `SELECT * FROM users WHERE name = '${username}'`;
// username = "'; DROP TABLE users; --"

// ✅ 安全：パラメータ化クエリ
const [rows] = await db.execute(
  "SELECT * FROM users WHERE name = ? AND status = ?",
  [username, "active"],
);

// ORM（Sequelize）の使用も同様に安全
const user = await User.findOne({
  where: { name: username },
  // Sequelizeが自動的にパラメータ化
});
```

## 環境変数とシークレット管理

```javascript
// ❌ ソースコードにシークレットをハードコードしない
const dbPassword = "my_super_secret_password";

// ✅ 常に環境変数を使用
const dbPassword = process.env.DB_PASSWORD;

// ローカル開発にはdotenvを使用
require("dotenv").config();
```

## ユーザー入力のサニタイズ

```javascript
const { body, validationResult } = require("express-validator");

app.post(
  "/user",
  [
    body("email").isEmail().normalizeEmail(),
    body("name").trim().escape().isLength({ min: 1, max: 50 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // req.body.emailとreq.body.nameを安全に使用可能
  },
);
```

セキュリティは一度きりのチェックリストではなく、継続的な実践です。依存関係を最新に保ち、`npm audit`で定期的な監査を実施しましょう。
