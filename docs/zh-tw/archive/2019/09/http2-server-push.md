---
title: "HTTP/2 Server Push 原理與實踐"
date: 2019-09-12 11:02:48
tags:
  - 前端
readingTime: 5
description: "HTTP/2 帶來了多路複用、頭部壓縮、服務端推送等重大改進。其中 Server Push 允許伺服器在客戶端請求之前主動推送資源，減少請求往返次數，顯著提升頁面載入速度。本文將深入講解 HTTP/2 Server Push 的工作原理，並結合 Node.js 和 Nginx 給出實戰配置。"
wordCount: 887
---

HTTP/2 帶來了多路複用、頭部壓縮、服務端推送等重大改進。其中 Server Push 允許伺服器在客戶端請求之前主動推送資源，減少請求往返次數，顯著提升頁面載入速度。本文將深入講解 HTTP/2 Server Push 的工作原理，並結合 Node.js 和 Nginx 給出實戰配置。

## HTTP/1.1 的資源載入瓶頸

在 HTTP/1.1 中，瀏覽器解析 HTML 後發現需要載入 CSS/JS，才會發起新的請求：

```
瀏覽器                          伺服器
  |
---- 請求 index.html -------->|  (第 1 次往返)
  |<---- 返回 index.html --------|
  |
  |---- 請求 style.css --------->|  (第 2 次往返)
  |<---- 返回 style.css ---------|
  |
  |---- 請求 app.js ------------>|  (第 3 次往返)
  |<---- 返回 app.js ------------|
```

每次往返都有網路延遲（RTT），資源越多，等待時間越長。

## HTTP/2 Server Push 的工作原理

Server Push 允許伺服器在響應 HTML 時，主動推送關聯的 CSS/JS：

```
瀏覽器                          伺服器
  |---- 請求 index.html -------->|
  |<---- 返回 index.html --------|
  |<---- 推送 style.css ---------|  (伺服器主動推送)
  |<---- 推送 app.js ------------|  (伺服器主動推送)
```

節省了兩次往返時間！

### 技術細節

Server Push 使用 HTTP/2 的 `PUSH_PROMISE` 幀：

1. 伺服器收到對 `index.html` 的請求
2. 伺服器傳送 `PUSH_PROMISE` 幀，告知客戶端即將推送 `style.css`
3. 客戶端檢查快取，如果已有該資源則傳送 `RST_STREAM` 拒絕推送
4. 如果客戶端需要，伺服器傳送資源資料

### 關鍵概念

- **推送快取（Push Cache）** — 推送的資源暫存在一個特殊的 HTTP/2 Push Cache 中，只有當瀏覽器真正需要該資源時才會使用
- **推送可以被拒絕** — 如果客戶端已有快取，可以拒絕伺服器的推送
- **推送與請求關聯** — 推送的資源關聯到觸發推送的那個請求

## Nginx 配置 Server Push

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        root /var/www/html;
        index index.html;

        # Server Push 配置
        http2_push /static/css/style.css;
        http2_push /static/js/vendor.js;
        http2_push /static/js/app.js;
    }

    # 也可以通過 Link header 觸發推送
    location = / {
        root /var/www/html;
        add_header Link "</static/css/style.css>; rel=preload; as=style";
        add_header Link "</static/js/vendor.js>; rel=preload; as=script";
    }
}
```

### 使用 Link header 動態推送

Nginx 支援通過響應頭中的 `Link` 欄位觸發推送：

```nginx
# 基於請求路徑動態決定推送內容
location / {
    # 根據頁面不同推送不同的關鍵資源
    set $push_headers "";

    # 首頁推送首屏關鍵資源
    if ($uri = "/") {
        add_header Link "</static/css/home.css>; rel=preload; as=style";
        add_header Link "</static/js/home.js>; rel=preload; as=script";
    }

    # 文章頁推送文章相關資源
    if ($uri ~ "^/posts/") {
        add_header Link "</static/css/post.css>; rel=preload; as=style";
    }
}
```

## Node.js 實現 Server Push

### 原生 http2 模組

```js
const http2 = require('http2');
const fs = require('fs');
const path = require('path');

const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_METHOD,
  HTTP2_HEADER_STATUS,
} = http2.constants;

const server = http2.createSecureSession({
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
});

const PUBLIC_DIR = path.join(__dirname, 'public');

const server = http2.createSecureServer({
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
});

server.on('stream', (stream, headers) => {
  const reqPath = headers[HTTP2_HEADER_PATH];

  if (reqPath === '/' || reqPath === '/index.html') {
    // 推送關鍵資源
    pushResource(stream, '/static/css/style.css', {
      [HTTP2_HEADER_PATH]: '/static/css/style.css',
    });

    pushResource(stream, '/static/js/app.js', {
      [HTTP2_HEADER_PATH]: '/static/js/app.js',
    });

    // 響應 HTML
    stream.respondWithFile(
      path.join(PUBLIC_DIR, 'index.html'),
      { 'content-type': 'text/html; charset=utf-8' }
    );
  } else {
    // 其他資源正常響應
    const filePath = path.join(PUBLIC_DIR, reqPath);
    stream.respondWithFile(filePath);
  }
});

function pushResource(parentStream, reqPath, pushHeaders) {
  parentStream.pushStream(pushHeaders, (err, pushStream) => {
    if (err) {
      console.error('推送失敗:', err);
      return;
    }

    const filePath = path.join(PUBLIC_DIR, reqPath);
    const ext = path.extname(filePath);
    const contentType = getContentType(ext);

    pushStream.respondWithFile(filePath, {
      'content-type': contentType,
    });
  });
}

function getContentType(ext) {
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return types[ext] || 'application/octet-stream';
}

server.listen(8443, () => {
  console.log('HTTPS/2 Server running on https://localhost:8443');
});
```

### Express + express-http2-push

```js
const express = require('express');
const http2 = require('http2');
const fs = require('fs');
const push = require('express-http2-push');

const app = express();

// 中介軟體：自動推送給定的資源
app.use(push({
  '/': [
    '/static/css/style.css',
    '/static/js/vendor.js',
    '/static/js/app.js',
  ],
  '/dashboard': [
    '/static/css/dashboard.css',
    '/static/js/dashboard.js',
  ],
}));

app.use(express.static('public'));

const server = http2.createSecureServer({
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
  allowHTTP1: true, // 回退到 HTTP/1.1
});

server.on('request', app);
server.listen(8443);
```

## 判斷哪些資源應該推送

不是所有資源都適合推送。適合推送的資源特徵：

1. **關鍵渲染路徑資源** — 首屏 CSS、首屏 JS
2. **體積較小** — 推送大檔案會阻塞主響應
3. **該頁面一定會用到** — 不會被其他條件跳過

### 分析關鍵資源

```js
// 使用 Lighthouse 獲取關鍵請求鏈
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function getCriticalResources(url) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse(url, options);
  const audits = runnerResult.lhr.audits;

  // 獲取關鍵請求鏈
  const criticalRequestChain = audits['critical-request-chains'];
  console.log('關鍵請求鏈:', criticalRequestChain);

  // 獲取首屏關鍵資源
  const renderBlocking = audits['render-blocking-resources'];
  console.log('阻塞渲染的資源:', renderBlocking);

  await chrome.kill();
}

getCriticalResources('https://example.com');
```

## 推送快取與客戶端快取的互動

### 問題：重複推送

如果客戶端已有快取，伺服器仍然推送，會浪費頻寬：

```
客戶端已有 style.css 快取
伺服器仍然推送 style.css
客戶端收到 PUSH_PROMISE 後拒絕（但推送資料已經發出了一部分）
```

### 解決方案：使用 Cookie 追蹤快取

```nginx
# 基於 Cookie 判斷是否需要推送
map $cookie_pushed_resources $need_push_css {
    default 1;
    "~style\.css" 0;
}

location / {
    if ($need_push_css) {
        http2_push /static/css/style.css;
    }

    # 設定 Cookie 記錄已推送的資源
    add_header Set-Cookie "pushed_resources=style.css; Path=/; Max-Age=86400";
}
```

### 更優雅的方案：103 Early Hints

HTTP/2 Server Push 的一個替代方案是 103 Early Hints：

```js
// Node.js 實現 103 Early Hints
server.on('stream', (stream, headers) => {
  // 先發送 103 Early Hints
  stream.additionalHeaders({
    ':status': '103',
    'link': '</static/css/style.css>; rel=preload; as=style',
  });

  // 然後正常響應
  setTimeout(() => {
    stream.respondWithFile('./index.html', {
      'content-type': 'text/html',
    });
  }, 100);
});
```

103 Early Hints 讓客戶端在伺服器處理請求的同時預載入資源，不需要伺服器決定推送什麼。

## Server Push 的注意事項

1. **不要過度推送** — 推送太多資源反而會阻塞主響應
2. **考慮已有快取** — 推送被快取的資源是浪費
3. **Push Cache 生命週期短** — 未使用的推送資源在連線關閉後就會丟棄
4. **需要 HTTPS** — HTTP/2 Server Push 只在 HTTPS 下可用
5. **測量實際效果** — 不同網路條件下效果不同，需要用 RUM 資料驗證

## 小結

- HTTP/2 Server Push 通過 `PUSH_PROMISE` 幀在客戶端請求前主動推送資源，減少 RTT
- 適合推送的資源：關鍵渲染路徑資源、體積小、該頁面一定用到的
- Nginx 配置簡單（`http2_push`），Node.js 需要使用 http2 模組手動實現
- 推送快取（Push Cache）與常規快取獨立，生命週期較短
- 需要注意避免重複推送已被快取的資源
- 103 Early Hints 是 Server Push 的輕量替代方案，讓客戶端自主決定是否預載入
- 務必使用 RUM 資料驗證 Server Push 的實際效能收益
