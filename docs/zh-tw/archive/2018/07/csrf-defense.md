---
title: "CSRF 攻擊與防禦實踐"
date: 2018-07-09 17:42:13
tags:
  - 安全
readingTime: 2
description: "之前寫過 XSS 防禦，這次聊 CSRF。兩者經常一起提，但原理完全不同。"
wordCount: 376
---

之前寫過 XSS 防禦，這次聊 CSRF。兩者經常一起提，但原理完全不同。

## CSRF 是什麼

CSRF（Cross-Site Request Forgery，跨站請求偽造）：攻擊者誘導已登入使用者訪問惡意頁面，惡意頁面以使用者身份發起請求。

```
正常流程：使用者 → 登入銀行網站（獲得 cookie）→ 轉賬

CSRF 攻擊：
使用者 → 登入銀行（有 cookie）
     → 訪問攻擊者頁面（含 <img src="https://bank.com/transfer?to=hacker&amount=10000">）
     → 瀏覽器自動發請求，帶上銀行的 cookie
     → 銀行執行了轉賬！
```

關鍵：瀏覽器發請求時自動攜帶目標域的 cookie，攻擊者無需知道 cookie 的值。

## 防禦方案

### 1. CSRF Token（最常用）

服務端生成隨機 token，嵌入表單/請求頭，攻擊者無法偽造：

```javascript
// 服務端：生成 token 並存 session
const csrfToken = crypto.randomBytes(32).toString("hex");
req.session.csrfToken = csrfToken;

// 返回給前端（放在響應頭或頁面 meta 標籤）
res.setHeader("X-CSRF-Token", csrfToken);
```

```javascript
// 前端：每個請求帶上 token
// axios 全域性配置
axios.interceptors.request.use((config) => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  if (token) {
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});
```

```javascript
// 服務端：驗證 token
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next(); // 隻讀請求不需要驗證
  }

  const token = req.headers["x-csrf-token"];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }
  next();
});
```

### 2. SameSite Cookie

現代瀏覽器支援 `SameSite` 屬性，控製跨站請求是否攜帶 cookie：

```
Set-Cookie: session=xxx; SameSite=Strict; HttpOnly; Secure
```

- `Strict`：跨站請求完全不攜帶 cookie
- `Lax`：允許跨站的導航（連結跳轉），不允許表單/fetch 請求（Chrome 80+ 預設值）
- `None`：允許跨站攜帶（必須同時設 Secure）

```javascript
// Express 設定 cookie
res.cookie("sessionId", token, {
  httpOnly: true,
  secure: true,
  sameSite: "lax", // 生產環境推薦 strict
});
```

### 3. Referer/Origin 驗證

檢查請求的來源域名：

```javascript
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.startsWith("https://yourdomain.com")) {
    return res.status(403).json({ error: "Invalid origin" });
  }
  next();
});
```

缺點：Referer 可能被使用者或代理過濾掉，不夠可靠。

## CSRF vs XSS

|                | CSRF                    | XSS                         |
| 
-------------- | ----------------------- | --------------------------- |
| 利用           | 使用者的身份（cookie）    | 瀏覽器執行攻擊者的程式碼      |
| 攻擊者能做什麼 | 以使用者身份發請求        | 讀取 cookie、改頁面、發請求 |
| 防禦核心       | Token + SameSite Cookie | CSP + 輸入轉義              |

## 小結

- CSRF 利用瀏覽器自動攜帶 cookie 的特性，讓使用者不知情地發請求
- CSRF Token 是最通用的防禦方案
- `SameSite: Lax/Strict` 是現代瀏覽器的有效防禦
- GET 請求不應有副作用（否則 img src 就能攻擊）
