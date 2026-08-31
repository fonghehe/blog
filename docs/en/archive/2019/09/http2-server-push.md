---
title: "HTTP/2 Server Push: Principles and Practice"
date: 2019-09-12 11:02:48
tags:
  - Frontend
readingTime: 5
description: "HTTP/2 brought major improvements such as multiplexing, header compression, and server push. Among them, Server Push lets the server proactively push resources to the client before it even asks, reducing the number of request round trips and noticeably speeding up page loads. This article explains how HTTP/2 Server Push works and provides practical configurations using Node.js and Nginx."
wordCount: 573
---

HTTP/2 brought major improvements such as multiplexing, header compression, and server push. Among them, Server Push lets the server proactively push resources to the client before it even asks, reducing the number of request round trips and noticeably speeding up page loads. This article explains how HTTP/2 Server Push works and provides practical configurations using Node.js and Nginx.

## HTTP/1.1 Resource Loading Bottlenecks

In HTTP/1.1, the browser only discovers it needs CSS/JS after parsing the HTML, and only then issues new requests:

```
Browser                        Server
  |---- Request index.html -------->|  (Round trip 1)
  |<---- Return index.html ---------|
  |
  |---- Request style.css --------->|  (Round trip 2)
  |<---- Return style.css ----------|
  |
  |---- Request app.js ------------>|  (Round trip 3)
  |<---- Return app.js -------------|
```

Each round trip incurs network latency (RTT). The more resources, the longer the wait.

## How HTTP/2 Server Push Works

Server Push lets the server proactively push the associated CSS/JS while responding to the HTML:

```
Browser                        Server
  |---- Request index.html -------->|
  |<---- Return index.html ---------|
  |<---- Push style.css ------------|  (server proactively pushes)
  |<---- Push app.js ---------------|  (server proactively pushes)
```

That saves two round trips!

### Technical Details

Server Push uses the `PUSH_PROMISE` frame of HTTP/2:

1. The server receives the request for `index.html`.
2. The server sends a `PUSH_PROMISE` frame, telling the client it is about to push `style.css`.
3. The client checks its cache and sends `RST_STREAM` to refuse the push if it already has the resource.
4. If the client needs it, the server sends the resource data.

### Key Concepts

- **Push cache** — pushed resources are held in a special HTTP/2 push cache and are only used when the browser actually needs them.
- **Pushes can be refused** — if the client already has the resource cached, it can refuse the server's push.
- **Pushes are tied to a request** — a pushed resource is associated with the request that triggered the push.

## Nginx Server Push Configuration

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

### Dynamic Push via the Link Header

Nginx can trigger pushes through the `Link` response header:

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

## Server Push with Node.js

### Native http2 Module

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

## Deciding Which Resources to Push

Not every resource is worth pushing. Resources that are good candidates share these traits:

1. **Critical rendering-path resources** — above-the-fold CSS and JS.
2. **Small in size** — pushing large files blocks the main response.
3. **Definitely used on that page** — not skipped by other conditions.

### Analyzing Critical Resources

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

## Push Cache and Client Cache Interaction

### Problem: Duplicate Pushes

If the client already has a resource cached but the server still pushes it, bandwidth is wasted:

```
Client already has style.css cached
Server still pushes style.css
Client receives PUSH_PROMISE and refuses it (but some push data was already sent)
```

### Solution: Track Cache with a Cookie

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

### A Cleaner Alternative: 103 Early Hints

An alternative to HTTP/2 Server Push is 103 Early Hints:

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

103 Early Hints lets the client preload resources while the server is still processing the request, without the server deciding what to push.

## Server Push Considerations

1. **Don't over-push** — pushing too many resources will block the main response.
2. **Account for existing caches** — pushing already-cached resources is wasteful.
3. **Short push-cache lifetime** — unused pushed resources are dropped once the connection closes.
4. **Requires HTTPS** — HTTP/2 Server Push is only available over HTTPS.
5. **Measure the actual effect** — results vary by network conditions; validate with RUM data.

## Summary

- HTTP/2 Server Push uses the `PUSH_PROMISE` frame to proactively push resources before the client requests them, cutting down RTT.
- Good candidates to push: critical rendering-path resources, small files, and resources the page is certain to use.
- Nginx configuration is simple (`http2_push`); Node.js requires implementing it manually with the http2 module.
- The push cache is independent from the regular cache and has a short lifetime.
- Be careful to avoid re-pushing resources that are already cached.
- 103 Early Hints is a lightweight alternative to Server Push, letting the client decide whether to preload.
- Always validate Server Push's real performance gains with RUM data.
