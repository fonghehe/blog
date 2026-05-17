---
title: "HTTP/2 Server Push：原理と実践"
date: 2019-09-12 11:02:48
tags:
  - フロントエンド
readingTime: 5
description: "HTTP/2 带来了多路复用、头部压缩、服务端推送等重大改进。其中 Server Push 允许服务器在客户端请求之前主动推送资源，减少请求往返次数，显著提升页面加载速度。本文将深入讲解 HTTP/2 Server Push 的工作原理，并结合 Node.js 和 Nginx 给出实战配置。"
---

HTTP/2 带来了多路复用、头部压缩、服务端推送等重大改进。其中 Server Push 允许服务器在客户端请求之前主动推送资源，减少请求往返次数，显著提升页面加载速度。本文将深入讲解 HTTP/2 Server Push 的工作原理，并结合 Node.js 和 Nginx 给出实战配置。

## HTTP/1.1のリソース読み込みのボトルネック

在 HTTP/1.1 中，浏览器解析 HTML 后发现需要加载 CSS/JS，才会发起新的请求：

```
浏览器                          服务器
  |---- 请求 index.html -------->|  (第 1 次往返)
  |<---- 返回 index.html --------|
  |
  |---- 请求 style.css --------->|  (第 2 次往返)
  |<---- 返回 style.css ---------|
  |
  |---- 请求 app.js ------------>|  (第 3 次往返)
  |<---- 返回 app.js ------------|
```

每次往返都有网络延迟（RTT），资源越多，等待时间越长。

## HTTP/2 Server Pushの仕組み

Server Push 允许服务器在响应 HTML 时，主动推送关联的 CSS/JS：

```
浏览器                          服务器
  |---- 请求 index.html -------->|
  |<---- 返回 index.html --------|
  |<---- 推送 style.css ---------|  (服务器主动推送)
  |<---- 推送 app.js ------------|  (服务器主动推送)
```

节省了两次往返时间！

### 技术细节

Server Push 使用 HTTP/2 的 `PUSH_PROMISE` 帧：

1. 服务器收到对 `index.html` 的请求
2. 服务器发送 `PUSH_PROMISE` 帧，告知客户端即将推送 `style.css`
3. 客户端检查缓存，如果已有该资源则发送 `RST_STREAM` 拒绝推送
4. 如果客户端需要，服务器发送资源数据

### 关键概念

- **推送缓存（Push Cache）** — 推送的资源暂存在一个特殊的 HTTP/2 Push Cache 中，只有当浏览器真正需要该资源时才会使用
- **推送可以被拒绝** — 如果客户端已有缓存，可以拒绝服务器的推送
- **推送与请求关联** — 推送的资源关联到触发推送的那个请求

## NginxのServer Push設定

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

    # 也可以通过 Link header 触发推送
    location = / {
        root /var/www/html;
        add_header Link "</static/css/style.css>; rel=preload; as=style";
        add_header Link "</static/js/vendor.js>; rel=preload; as=script";
    }
}
```

### 使用 Link header 动态推送

Nginx 支持通过响应头中的 `Link` 字段触发推送：

```nginx
# 基于请求路径动态决定推送内容
location / {
    # 根据页面不同推送不同的关键资源
    set $push_headers "";

    # 首页推送首屏关键资源
    if ($uri = "/") {
        add_header Link "</static/css/home.css>; rel=preload; as=style";
        add_header Link "</static/js/home.js>; rel=preload; as=script";
    }

    # 文章页推送文章相关资源
    if ($uri ~ "^/posts/") {
        add_header Link "</static/css/post.css>; rel=preload; as=style";
    }
}
```

## Node.jsでServer Pushを実装する

### 原生 http2 模块

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
    // 推送关键资源
    pushResource(stream, '/static/css/style.css', {
      [HTTP2_HEADER_PATH]: '/static/css/style.css',
    });

    pushResource(stream, '/static/js/app.js', {
      [HTTP2_HEADER_PATH]: '/static/js/app.js',
    });

    // 响应 HTML
    stream.respondWithFile(
      path.join(PUBLIC_DIR, 'index.html'),
      { 'content-type': 'text/html; charset=utf-8' }
    );
  } else {
    // 其他资源正常响应
    const filePath = path.join(PUBLIC_DIR, reqPath);
    stream.respondWithFile(filePath);
  }
});

function pushResource(parentStream, reqPath, pushHeaders) {
  parentStream.pushStream(pushHeaders, (err, pushStream) => {
    if (err) {
      console.error('推送失败:', err);
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

// 中间件：自动推送给定的资源
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

## どのリソースをプッシュすべきか判断する

不是所有资源都适合推送。适合推送的资源特征：

1. **关键渲染路径资源** — 首屏 CSS、首屏 JS
2. **体积较小** — 推送大文件会阻塞主响应
3. **该页面一定会用到** — 不会被其他条件跳过

### 分析关键资源

```js
// 使用 Lighthouse 获取关键请求链
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

  // 获取关键请求链
  const criticalRequestChain = audits['critical-request-chains'];
  console.log('关键请求链:', criticalRequestChain);

  // 获取首屏关键资源
  const renderBlocking = audits['render-blocking-resources'];
  console.log('阻塞渲染的资源:', renderBlocking);

  await chrome.kill();
}

getCriticalResources('https://example.com');
```

## プッシュキャッシュとクライアントキャッシュの相互作用

### 问题：重复推送

如果客户端已有缓存，服务器仍然推送，会浪费带宽：

```
客户端已有 style.css 缓存
服务器仍然推送 style.css
客户端收到 PUSH_PROMISE 后拒绝（但推送数据已经发出了一部分）
```

### 解决方案：使用 Cookie 追踪缓存

```nginx
# 基于 Cookie 判断是否需要推送
map $cookie_pushed_resources $need_push_css {
    default 1;
    "~style\.css" 0;
}

location / {
    if ($need_push_css) {
        http2_push /static/css/style.css;
    }

    # 设置 Cookie 记录已推送的资源
    add_header Set-Cookie "pushed_resources=style.css; Path=/; Max-Age=86400";
}
```

### 更优雅的方案：103 Early Hints

HTTP/2 Server Push 的一个替代方案是 103 Early Hints：

```js
// Node.js 实现 103 Early Hints
server.on('stream', (stream, headers) => {
  // 先发送 103 Early Hints
  stream.additionalHeaders({
    ':status': '103',
    'link': '</static/css/style.css>; rel=preload; as=style',
  });

  // 然后正常响应
  setTimeout(() => {
    stream.respondWithFile('./index.html', {
      'content-type': 'text/html',
    });
  }, 100);
});
```

103 Early Hints 让客户端在服务器处理请求的同时预加载资源，不需要服务器决定推送什么。

## Server Pushの注意事項

1. **不要过度推送** — 推送太多资源反而会阻塞主响应
2. **考虑已有缓存** — 推送被缓存的资源是浪费
3. **Push Cache 生命周期短** — 未使用的推送资源在连接关闭后就会丢弃
4. **需要 HTTPS** — HTTP/2 Server Push 只在 HTTPS 下可用
5. **测量实际效果** — 不同网络条件下效果不同，需要用 RUM 数据验证

## まとめ

- HTTP/2 Server Push 通过 `PUSH_PROMISE` 帧在客户端请求前主动推送资源，减少 RTT
- 适合推送的资源：关键渲染路径资源、体积小、该页面一定用到的
- Nginx 配置简单（`http2_push`），Node.js 需要使用 http2 模块手动实现
- 推送缓存（Push Cache）与常规缓存独立，生命周期较短
- 需要注意避免重复推送已被缓存的资源
- 103 Early Hints 是 Server Push 的轻量替代方案，让客户端自主决定是否预加载
- 务必使用 RUM 数据验证 Server Push 的实际性能收益
