---
title: "前端安全 2026：CSP v3 與子資源完整性"
date: 2026-06-15 14:39:35
tags:
  - 安全
readingTime: 1
description: "Content Security Policy v3 和 Subresource Integrity 是 2026 年前端安全的兩大支柱。本文討論 CSP 的設定策略、SRI 的使用方法和常見的安全陷阱。"
wordCount: 201
---

前端安全不再是「可選的附加項」，而是應用架構的核心部分。2026 年的 Web 安全環境更加複雜，CSP v3 和 SRI 提供了標準化的防護機制。

## Content Security Policy 基礎

CSP 透過 HTTP 頭或 meta 標籤控制資源載入：

```html
<!-- HTTP 頭 -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'

<!-- meta 標籤 -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'nonce-abc123'">
```

## CSP v3 新特性

```html
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-abc123' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

關鍵改進：
- **`strict-dynamic`**：信任已有腳本載入的新腳本
- **`frame-ancestors`**：替代 `X-Frame-Options`
- **`base-uri`**：防止 `<base>` 標籤劫持
- **`form-action`**：限制表單提交目標

## Nonce 生成與使用

```typescript
// 伺服器端產生 nonce
function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

// 中介軟體新增 CSP 頭
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.cspNonce = nonce;
  
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
  `);
  
  next();
});
```

## Subresource Integrity

SRI 確保外部資源不被篡改：

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

## 漸進式部署

```html
<!-- 階段 1：僅報告 -->
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report

<!-- 階段 2：寬鬆策略 -->
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval'

<!-- 階段 3：嚴格策略 -->
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxx'
```

## 小結

CSP v3 和 SRI 是 2026 年前端安全的基礎。CSP 控制資源載入來源，SRI 確保資源完整性。部署時應該漸進式啟用，先用 Report-Only 收集資料，再逐步收緊策略。
