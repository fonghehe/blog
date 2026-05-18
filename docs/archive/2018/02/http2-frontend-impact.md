---
title: "HTTP/2 对前端资源加载的实际影响"
date: 2018-02-13 17:42:20
tags:
  - 前端
readingTime: 3
description: "HTTP/2 已经推出几年了，但很多前端开发者还不清楚它到底改变了什么，以及对前端优化策略的影响。这篇文章讲实际的变化。"
---

HTTP/2 已经推出几年了，但很多前端开发者还不清楚它到底改变了什么，以及对前端优化策略的影响。这篇文章讲实际的变化。

## HTTP/1.1 的主要瓶颈

在 HTTP/1.1 时代，浏览器对同一域名的并发请求数有限制（一般 6 个）。这导致了一个经典问题：

```
资源 1 ──── 等待 ──────── 加载
资源 2 ──── 等待 ──────────── 加载
资源 3 ──── 等待 ────────────── 加载
资源 4                 ─── 等待 ──── 加载
资源 5                 ─── 等待 ──────── 加载
资源 6                 ─── 等待 ────────── 加载
```

为了绕过这个限制，我们发明了很多"技巧"：

- **Domain Sharding**（域名分片）：把资源分布到多个子域名
- **Image Sprites**（雪碧图）：把多个小图合并成一张大图
- **文件合并**：把多个 JS/CSS 合并成一个大文件

## HTTP/2 的多路复用

HTTP/2 的核心改进是**多路复用（Multiplexing）**：一条 TCP 连接可以同时传输多个请求和响应，不再有并发数限制。

```
HTTP/1.1                    HTTP/2

请求1  ───────── 响应1      请求1 ─┐ 响应1 ─┐
等待...                     请求2  ├──────  ├── 同时
请求2  ───────── 响应2      请求3  ┘ 响应2  │
等待...                           响应3 ─┘
请求3  ───────── 响应3
```

## 对前端优化策略的影响

### Domain Sharding 不再必要

HTTP/1.1 时代，`cdn1.example.com`、`cdn2.example.com` 绕过并发限制，现在反而有害：

- HTTP/2 多路复用在同一连接上工作
- 多域名 = 多条 TCP 连接 = 更多握手开销
- **结论**：HTTP/2 下合并到同一域名更好

### 文件合并策略变了

HTTP/1.1：把所有 JS 合并成一个大文件，减少请求数
HTTP/2：请求数不再是瓶颈，可以适当拆分文件

```javascript
// HTTP/1.1 时代的 Webpack 配置思路
// 尽量合并，减少文件数

// HTTP/2 时代
// 可以按模块拆分，利用浏览器缓存的细粒度
optimization: {
  splitChunks: {
    cacheGroups: {
      vue: { test: /vue/, name: 'vue', chunks: 'all' },
      axios: { test: /axios/, name: 'axios', chunks: 'all' },
      elementUI: { test: /element-ui/, name: 'element-ui', chunks: 'all' }
    }
  }
}
```

细粒度拆分的好处：`vue` 版本不变的话，用户访问新版本时不需要重新下载 `vue.js`。

### Server Push

HTTP/2 支持服务器主动推送资源：

```
浏览器: 请求 index.html
服务器: 给你 index.html，顺便给你 main.css 和 main.js（你等会肯定要的）
浏览器: （main.css 和 main.js 已经在本地了，不用再请求了）
```

Nginx 配置 Server Push：

```nginx
location = /index.html {
  http2_push /static/main.css;
  http2_push /static/main.js;
}
```

### 雪碧图依然有价值（部分场景）

虽然 HTTP/2 解决了请求并发问题，但每个小图标都是独立文件的话，有些开销还是存在的（连接建立、TLS 握手等对 HTTP/2 影响小，但图标通常还有其他原因合并）。

**Icon font 或 SVG Sprite 依然是更好的图标方案**，但不是因为请求数，而是因为可控性和可维护性。

## 检查你的网站是否使用 HTTP/2

在 Chrome DevTools 的 Network 面板，右键表头，开启 "Protocol" 列：

- `h2` = HTTP/2
- `http/1.1` = HTTP/1.1

如果你的服务器还没升级 HTTP/2，以下是 Nginx 的配置方式：

```nginx
server {
  listen 443 ssl http2;          # 关键：加上 http2
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  # HTTP/2 需要 HTTPS，所以先确保 HTTPS 配置正确
}
```

## 实际压测数据（参考）

在我们的中后台项目（约 30 个 JS/CSS 文件）对比：

| 场景                 | 首次加载时间 |
| 
-------------------- | ------------ |
| HTTP/1.1             | 2.8s         |
| HTTP/2               | 1.6s         |
| HTTP/2 + Server Push | 1.2s         |

不同网络环境差异较大，但 HTTP/2 的改善通常是明显的。

## 小结

- HTTP/2 多路复用解决了并发限制，很多 HTTP/1.1 时代的"优化技巧"不再必要
- 域名分片反而有害，合并到同一域名更好
- 文件可以适当细粒度拆分，提高缓存利用率
- Server Push 是额外增益，但需要服务端支持
- 升级 HTTP/2 需要先有 HTTPS
