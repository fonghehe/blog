---
title: "前端安全之 CSP (Content Security Policy)"
date: 2019-07-04 14:30:53
tags:
  - 安全
readingTime: 4
description: "前端安全是每个开发者都应该重视的话题。XSS 攻击防不胜防，单纯靠过滤用户输入很难做到万无一失。CSP（Content Security Policy）提供了一种从浏览器层面限制资源加载和脚本执行的机制，是 XSS 防御的重要补充。"
wordCount: 865
---

前端安全是每个开发者都应该重视的话题。XSS 攻击防不胜防，单纯靠过滤用户输入很难做到万无一失。CSP（Content Security Policy）提供了一种从浏览器层面限制资源加载和脚本执行的机制，是 XSS 防御的重要补充。

## CSP 是什么

CSP 是一个 HTTP 响应头，告诉浏览器哪些资源可以加载、哪些不可以。即使攻击者成功注入了恶意脚本，CSP 也能阻止浏览器执行它。

最基本的 CSP 头长这样：

```
Content-Security-Policy: default-src 'self'
```

这行配置意味着：所有资源（脚本、样式、图片、字体等）只能从同源加载。

## 配置方式

### 方式一：HTTP 响应头（推荐）

Nginx 配置：

```nginx
server {
    listen 80;
    server_name example.com;

    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self' https://cdn.jsdelivr.net;
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self' https://api.example.com;
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self';
    ";
}
```

Express 配置：

```javascript
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'",
  );
  next();
});
```

### 方式二：meta 标签

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'"
/>
```

注意：`meta` 标签方式不支持 `report-uri`、`frame-ancestors` 等指令，所以生产环境建议用 HTTP 头。

## 常用指令详解

| 指令              | 作用                                       |
| 
----------------- | ------------------------------------------ |
| `default-src`     | 所有资源类型的默认策略                     |
| `script-src`      | JavaScript 脚本                            |
| `style-src`       | CSS 样式表                                 |
| `img-src`         | 图片                                       |
| `font-src`        | 字体文件                                   |
| `connect-src`     | fetch、XHR、WebSocket 等                   |
| `frame-src`       | iframe 加载                                |
| `media-src`       | 音视频                                     |
| `object-src`      | `<object>`、`<embed>`                      |
| `base-uri`        | `<base>` 标签                              |
| `form-action`     | 表单提交目标                               |
| `frame-ancestors` | 谁可以嵌套当前页面（替代 X-Frame-Options） |

## nonce 方案：解决 inline script 问题

很多项目（特别是用了 Webpack 打包的）会生成 inline script。CSP 默认会阻止所有 inline script，除非你使用 `'unsafe-inline'`，但这等于把安全大门又打开了。

更好的方案是 **nonce**（一次性随机数）：

```
Content-Security-Policy: script-src 'nonce-random123abc'
```

```html
<!-- 这个会被执行 -->
<script nonce="random123abc">
  console.log("安全的内联脚本");
</script>

<!-- 这个会被阻止 -->
<script>
  alert("恶意脚本");
</script>
```

在 Node.js 中的实践：

```javascript
const crypto = require("crypto");

app.use((req, res, next) => {
  // 每次请求生成随机 nonce
  const nonce = crypto.randomBytes(16).toString("base64");

  // 设置 CSP 头
  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`,
  );

  // 把 nonce 传给模板
  res.locals.nonce = nonce;
  next();
});
```

```html
<!-- 模板中使用 -->
<script nonce="&#123;&#123; nonce &#125;&#125;">
  // 应用初始化代码
  window.__INITIAL_STATE__ = &#123;&#123; state &#125;&#125;
</script>
```

## Webpack + CSP 的配合

Webpack 打包后默认会生成 inline runtime 代码。要配合 CSP，需要做如下配置：

```javascript
// webpack.config.js
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  output: {
    // 使用 webpack runtime 作为单独 chunk
    // 避免 inline 到 HTML 中
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      nonce: "<%= nonce %>",
    }),
  ],
};
```

如果用 `mini-css-extract-plugin` 把 CSS 提取成文件而不是 inline style，可以安全地移除 `'unsafe-inline'` 对 style-src 的需求：

```javascript
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "css/[name].[contenthash:8].css",
    }),
  ],
};
```

## report-uri：监控违规行为

配置 `report-uri` 可以让浏览器在检测到 CSP 违规时自动上报：

```
Content-Security-Policy: default-src 'self'; report-uri /csp-report
```

```javascript
// 后端接收违规报告
app.post(
  "/csp-report",
  express.json({ type: "application/csp-report" }),
  (req, res) => {
    const report = req.body["csp-report"];
    console.error("CSP Violation:", {
      blockedUri: report["blocked-uri"],
      violatedDirective: report["violated-directive"],
      documentUri: report["document-uri"],
      sourceFile: report["source-file"],
      lineNumber: report["line-number"],
    });

    res.status(204).end();
  },
);
```

违规报告的数据结构：

```json
{
  "csp-report": {
    "document-uri": "https://example.com/page",
    "blocked-uri": "https://evil.com/steal.js",
    "violated-directive": "script-src 'self'",
    "effective-directive": "script-src",
    "original-policy": "default-src 'self'; report-uri /csp-report",
    "disposition": "enforce",
    "status-code": 200,
    "line-number": 15,
    "column-number": 2,
    "source-file": "https://example.com/page"
  }
}
```

还有 `Content-Security-Policy-Report-Only` 头，只上报不阻止，适合上线前的灰度测试：

```
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

## 常见绕过与防御

### JSONP 绕过

如果 `script-src` 允许了某个域名，攻击者可以通过该域名的 JSONP 接口注入脚本：

```html
<!-- 如果 script-src 允许了 trusted.com -->
<script src="https://trusted.com/api?callback=alert(1)"></script>
```

防御：精确到路径级别，不要整站放行：

```
# 不要这样
script-src https://trusted.com

# 应该这样
script-src https://trusted.com/api/safe-endpoint
```

### base-uri 绕过

攻击者注入 `<base href="https://evil.com/">` 后，页面上所有相对路径的资源都会从恶意域名加载：

```html
<base href="https://evil.com/" />
<script src="/steal-cookies.js"></script>
```

防御：限制 `base-uri`：

```
base-uri 'self'
```

### Angular 模板注入

如果页面用了 AngularJS 1.x，`&#123;&#123;constructor.constructor('alert(1)')()&#125;&#125;`这样的表达式可以绕过某些 CSP 配置。

防御：`script-src` 中使用 nonce，不要使用 `'unsafe-inline'` 或 `'unsafe-eval'`。

## 实际项目中的 CSP 配置模板

一个相对完整的生产环境配置：

```
Content-Security-Policy:
    default-src 'self';
    script-src 'self' 'nonce-{random}';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://cdn.example.com;
    font-src 'self' https://fonts.googleapis.com;
    connect-src 'self' https://api.example.com wss://ws.example.com;
    media-src 'none';
    object-src 'none';
    frame-src 'none';
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
    report-uri /csp-report;
```

几个注意点：

- `style-src 'unsafe-inline'` 很多项目暂时无法避免，因为 Vue/React 的组件库大量使用 inline style
- `object-src 'none'` 和 `frame-src 'none'` 是防止老版本浏览器绕过的重要手段
- `upgrade-insecure-requests` 会自动将 HTTP 请求升级为 HTTPS

## 小结

- CSP 是 XSS 防御的最后一道防线，即使输入过滤被突破，CSP 也能阻止恶意脚本执行
- 优先使用 HTTP 响应头配置，而非 `<meta>` 标签
- nonce 方案比 `'unsafe-inline'` 安全得多，建议脚本全部使用 nonce
- 配置 `report-uri` 监控线上 CSP 违规，先用 Report-Only 模式收集数据再切换到 enforce
- 注意 JSONP、base 标签等间接绕过方式
- CSP 不是万能的，需要与输入过滤、输出编码、HttpOnly Cookie 等手段配合使用
