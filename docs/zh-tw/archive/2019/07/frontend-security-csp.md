---
title: "前端安全之 CSP (Content Security Policy)"
date: 2019-07-04 14:30:53
tags:
  - 安全
readingTime: 4
description: "前端安全是每個開發者都應該重視的話題。XSS 攻擊防不勝防，單純靠過濾使用者輸入很難做到萬無一失。CSP（Content Security Policy）提供了一種從瀏覽器層面限制資源載入和指令碼執行的機制，是 XSS 防禦的重要補充。"
---

前端安全是每個開發者都應該重視的話題。XSS 攻擊防不勝防，單純靠過濾使用者輸入很難做到萬無一失。CSP（Content Security Policy）提供了一種從瀏覽器層面限制資源載入和指令碼執行的機制，是 XSS 防禦的重要補充。

## CSP 是什麼

CSP 是一個 HTTP 響應頭，告訴瀏覽器哪些資源可以載入、哪些不可以。即使攻擊者成功注入了惡意指令碼，CSP 也能阻止瀏覽器執行它。

最基本的 CSP 頭長這樣：

```
Content-Security-Policy: default-src 'self'
```

這行配置意味著：所有資源（指令碼、樣式、圖片、字型等）只能從同源載入。

## 配置方式

### 方式一：HTTP 響應頭（推薦）

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

### 方式二：meta 標籤

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'"
/>
```

注意：`meta` 標籤方式不支援 `report-uri`、`frame-ancestors` 等指令，所以生產環境建議用 HTTP 頭。

## 常用指令詳解

| 指令              | 作用                                       |
| 
----------------- | ------------------------------------------ |
| `default-src`     | 所有資源型別的預設策略                     |
| `script-src`      | JavaScript 指令碼                            |
| `style-src`       | CSS 樣式表                                 |
| `img-src`         | 圖片                                       |
| `font-src`        | 字型檔案                                   |
| `connect-src`     | fetch、XHR、WebSocket 等                   |
| `frame-src`       | iframe 載入                                |
| `media-src`       | 音影片                                     |
| `object-src`      | `<object>`、`<embed>`                      |
| `base-uri`        | `<base>` 標籤                              |
| `form-action`     | 表單提交目標                               |
| `frame-ancestors` | 誰可以巢狀當前頁面（替代 X-Frame-Options） |

## nonce 方案：解決 inline script 問題

很多專案（特別是用了 Webpack 打包的）會生成 inline script。CSP 預設會阻止所有 inline script，除非你使用 `'unsafe-inline'`，但這等於把安全大門又打開了。

更好的方案是 **nonce**（一次性隨機數）：

```
Content-Security-Policy: script-src 'nonce-random123abc'
```

```html
<!-- 這個會被執行 -->
<script nonce="random123abc">
  console.log("安全的內聯指令碼");
</script>

<!-- 這個會被阻止 -->
<script>
  alert("惡意指令碼");
</script>
```

在 Node.js 中的實踐：

```javascript
const crypto = require("crypto");

app.use((req, res, next) => {
  // 每次請求生成隨機 nonce
  const nonce = crypto.randomBytes(16).toString("base64");

  // 設定 CSP 頭
  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`,
  );

  // 把 nonce 傳給模板
  res.locals.nonce = nonce;
  next();
});
```

```html
<!-- 模板中使用 -->
<script nonce="&#123;&#123; nonce &#125;&#125;">
  // 應用初始化程式碼
  window.__INITIAL_STATE__ = &#123;&#123; state &#125;&#125;
</script>
```

## Webpack + CSP 的配合

Webpack 打包後預設會生成 inline runtime 程式碼。要配合 CSP，需要做如下配置：

```javascript
// webpack.config.js
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  output: {
    // 使用 webpack runtime 作為單獨 chunk
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

如果用 `mini-css-extract-plugin` 把 CSS 提取成檔案而不是 inline style，可以安全地移除 `'unsafe-inline'` 對 style-src 的需求：

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

## report-uri：監控違規行為

配置 `report-uri` 可以讓瀏覽器在檢測到 CSP 違規時自動上報：

```
Content-Security-Policy: default-src 'self'; report-uri /csp-report
```

```javascript
// 後端接收違規報告
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

違規報告的資料結構：

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

還有 `Content-Security-Policy-Report-Only` 頭，只上報不阻止，適合上線前的灰度測試：

```
Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
```

## 常見繞過與防禦

### JSONP 繞過

如果 `script-src` 允許了某個域名，攻擊者可以通過該域名的 JSONP 介面注入指令碼：

```html
<!-- 如果 script-src 允許了 trusted.com -->
<script src="https://trusted.com/api?callback=alert(1)"></script>
```

防禦：精確到路徑級別，不要整站放行：

```
# 不要這樣
script-src https://trusted.com

# 應該這樣
script-src https://trusted.com/api/safe-endpoint
```

### base-uri 繞過

攻擊者注入 `<base href="https://evil.com/">` 後，頁面上所有相對路徑的資源都會從惡意域名載入：

```html
<base href="https://evil.com/" />
<script src="/steal-cookies.js"></script>
```

防禦：限制 `base-uri`：

```
base-uri 'self'
```

### Angular 模板注入

如果頁面用了 AngularJS 1.x，`&#123;&#123;constructor.constructor('alert(1)')()&#125;&#125;`這樣的表示式可以繞過某些 CSP 配置。

防禦：`script-src` 中使用 nonce，不要使用 `'unsafe-inline'` 或 `'unsafe-eval'`。

## 實際專案中的 CSP 配置模板

一個相對完整的生產環境配置：

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

幾個注意點：

- `style-src 'unsafe-inline'` 很多專案暫時無法避免，因為 Vue/React 的元件庫大量使用 inline style
- `object-src 'none'` 和 `frame-src 'none'` 是防止老版本瀏覽器繞過的重要手段
- `upgrade-insecure-requests` 會自動將 HTTP 請求升級為 HTTPS

## 小結

- CSP 是 XSS 防禦的最後一道防線，即使輸入過濾被突破，CSP 也能阻止惡意指令碼執行
- 優先使用 HTTP 響應頭配置，而非 `<meta>` 標籤
- nonce 方案比 `'unsafe-inline'` 安全得多，建議指令碼全部使用 nonce
- 配置 `report-uri` 監控線上 CSP 違規，先用 Report-Only 模式收集資料再切換到 enforce
- 注意 JSONP、base 標籤等間接繞過方式
- CSP 不是萬能的，需要與輸入過濾、輸出編碼、HttpOnly Cookie 等手段配合使用
