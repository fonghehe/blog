---
title: "前端安全 2026：CSP Level 3 與 Trusted Types 的導入實踐"
date: 2026-06-19 12:56:59
tags:
  - 安全
readingTime: 1
description: "XSS 攻擊依然是前端安全的最大威脅。本文系統講解 CSP Level 3 和 Trusted Types 在實際項目中的應用，幫助你構建更安全的前端應用。"
wordCount: 269
---

XSS（跨站腳本攻擊）是 OWASP Top 10 中長期存在的安全威脅。2026 年，CSP Level 3 和 Trusted Types 已經成為防禦 XSS 的核心技術。理解它們的原理和實踐方法，是每個前端開發者的必備能力。

## XSS 攻擊的本質

XSS 攻擊的核心是攻擊者能夠向頁面注入惡意腳本並執行：

```html
<!-- 反射型 XSS -->
<img src="x" onerror="alert('XSS')">

<!-- 存儲型 XSS -->
<div class="comment">
  <script>stealCookies()</script>
</div>
```

## CSP Level 3 基礎

Content Security Policy（CSP）通過限制頁面可以加載和執行的資源來防禦 XSS：

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-random123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
">
```

### Nonce 和 Hash

Nonce（一次性隨機數）和 Hash 是 CSP 中最安全的腳本加載方式：

```html
<script nonce="random123">
  // 只有帶有正確 nonce 的腳本才能執行
  console.log('This script is allowed')
</script>
```

## Trusted Types 詳解

Trusted Types 是 Google 提出的 DOM XSS 防禦方案，它強制所有 DOM 操作使用類型安全的 API：

```javascript
// 禁止直接使用 innerHTML
element.innerHTML = userInput  // ❌ 違反 CSP

// 必須通過 TrustedHTML
const trustedHTML = trustedTypes.createPolicy('default', {
  createHTML: (input) => {
    return DOMPurify.sanitize(input)
  }
})

element.innerHTML = trustedHTML.createHTML(userInput)  // ✅ 允許
```

## 漸進式遷移策略

```javascript
// 第一步：只報告不阻止
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  report-uri /csp-report;
">

// 第二步：添加常用指令
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  report-uri /csp-report;
">

// 第三步：啟用 Trusted Types
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-${NONCE}';
  style-src 'self' 'unsafe-inline';
  trusted-types default;
  report-uri /csp-report;
">
```

## 總結

CSP Level 3 和 Trusted Types 是現代前端安全的基石。CSP 通過限制資源來源來防禦 XSS，Trusted Types 通過類型安全的 API 來防止 DOM 注入攻擊。在實際項目中，推薦漸進式遷移：先報告違規，再逐步啟用嚴格策略。
