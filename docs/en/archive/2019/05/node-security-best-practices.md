---
title: "Node.js Security Best Practices: Common Vulnerabilities and Defenses"
date: 2019-05-03 15:56:46
tags:
  - Node.js
readingTime: 1
description: "Node.js engineers can easily fall into security traps — not from lack of skill, but from lack of attention. This article covers commonly overlooked security pra"
---

Node.js engineers can easily fall into security traps — not from lack of skill, but from lack of attention. This article covers commonly overlooked security practices in everyday development.

## Helmet: Hardening HTTP Headers

```javascript
const express = require("express");
const helmet = require("helmet");

const app = express();

// One line covers many security headers:
// X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.
app.use(helmet());

// Or configure on demand
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

## Rate Limiting to Prevent Brute Force

```javascript
const rateLimit = require("express-rate-limit");

// Login endpoint rate limiting:
// same IP can try at most 10 times within 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
});
app.post("/auth/login", loginLimiter, loginController);

// Global API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use("/api/", apiLimiter);
```

## Preventing SQL Injection

```javascript
// ❌ Dangerous: string concatenation
const query = `SELECT * FROM users WHERE name = '${username}'`;
// username = "'; DROP TABLE users; --"

// ✅ Safe: parameterized query
const [rows] = await db.execute(
  "SELECT * FROM users WHERE name = ? AND status = ?",
  [username, "active"],
);

// Using an ORM (Sequelize) is equally safe
const user = await User.findOne({
  where: { name: username },
  // Sequelize automatically parameterizes
});
```

## Environment Variables and Secret Management

```javascript
// ❌ Never hardcode secrets in source code
const dbPassword = "my_super_secret_password";

// ✅ Always use environment variables
const dbPassword = process.env.DB_PASSWORD;

// Use dotenv for local development
require("dotenv").config();
```

## Sanitizing User Input

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
    // safe to use req.body.email and req.body.name
  },
);
```

Security is a continuous practice, not a one-time checklist. Keep dependencies updated and run regular audits with `npm audit`.
