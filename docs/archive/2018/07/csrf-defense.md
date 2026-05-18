---
title: "CSRF 攻击与防御实践"
date: 2018-07-09 17:42:13
tags:
  - 安全
readingTime: 2
description: "之前写过 XSS 防御，这次聊 CSRF。两者经常一起提，但原理完全不同。"
---

之前写过 XSS 防御，这次聊 CSRF。两者经常一起提，但原理完全不同。

## CSRF 是什么

CSRF（Cross-Site Request Forgery，跨站请求伪造）：攻击者诱导已登录用户访问恶意页面，恶意页面以用户身份发起请求。

```
正常流程：用户 → 登录银行网站（获得 cookie）→ 转账

CSRF 攻击：
用户 → 登录银行（有 cookie）
     → 访问攻击者页面（含 <img src="https://bank.com/transfer?to=hacker&amount=10000">）
     → 浏览器自动发请求，带上银行的 cookie
     → 银行执行了转账！
```

关键：浏览器发请求时自动携带目标域的 cookie，攻击者无需知道 cookie 的值。

## 防御方案

### 1. CSRF Token（最常用）

服务端生成随机 token，嵌入表单/请求头，攻击者无法伪造：

```javascript
// 服务端：生成 token 并存 session
const csrfToken = crypto.randomBytes(32).toString("hex");
req.session.csrfToken = csrfToken;

// 返回给前端（放在响应头或页面 meta 标签）
res.setHeader("X-CSRF-Token", csrfToken);
```

```javascript
// 前端：每个请求带上 token
// axios 全局配置
axios.interceptors.request.use((config) => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (token) {
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});
```

```javascript
// 服务端：验证 token
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next(); // 只读请求不需要验证
  }

  const token = req.headers["x-csrf-token"];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }
  next();
});
```

### 2. SameSite Cookie

现代浏览器支持 `SameSite` 属性，控制跨站请求是否携带 cookie：

```
Set-Cookie: session=xxx; SameSite=Strict; HttpOnly; Secure
```

- `Strict`：跨站请求完全不携带 cookie
- `Lax`：允许跨站的导航（链接跳转），不允许表单/fetch 请求（Chrome 80+ 默认值）
- `None`：允许跨站携带（必须同时设 Secure）

```javascript
// Express 设置 cookie
res.cookie("sessionId", token, {
  httpOnly: true,
  secure: true,
  sameSite: "lax", // 生产环境推荐 strict
});
```

### 3. Referer/Origin 验证

检查请求的来源域名：

```javascript
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.startsWith("https://yourdomain.com")) {
    return res.status(403).json({ error: "Invalid origin" });
  }
  next();
});
```

缺点：Referer 可能被用户或代理过滤掉，不够可靠。

## CSRF vs XSS

|                | CSRF                    | XSS                         |
| 
-------------- | ----------------------- | --------------------------- |
| 利用           | 用户的身份（cookie）    | 浏览器执行攻击者的代码      |
| 攻击者能做什么 | 以用户身份发请求        | 读取 cookie、改页面、发请求 |
| 防御核心       | Token + SameSite Cookie | CSP + 输入转义              |

## 小结

- CSRF 利用浏览器自动携带 cookie 的特性，让用户不知情地发请求
- CSRF Token 是最通用的防御方案
- `SameSite: Lax/Strict` 是现代浏览器的有效防御
- GET 请求不应有副作用（否则 img src 就能攻击）
