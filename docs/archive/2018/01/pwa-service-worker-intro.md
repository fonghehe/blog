---
title: "PWA 渐进式 Web 应用入门：Service Worker 核心概念"
date: 2018-01-16 11:07:28
tags:
  - PWA
---

PWA（Progressive Web App）这个概念 Google 在 2015 年提出，到 2018 年技术已经相当成熟，iOS 11.3 也终于加入了基础的 Service Worker 支持。这篇文章从实际角度讲 PWA 的核心机制。

## PWA 不是一个具体的 API

很多人问"PWA 用什么框架"，这个问题问错了方向。PWA 是一组技术的集合，包括：

- **Service Worker**：网络代理，实现离线缓存、推送通知
- **Web App Manifest**：让应用可以"添加到主屏幕"
- **HTTPS**：Service Worker 要求安全上下文
- **响应式设计**：在各种屏幕上良好显示

你可以给任何现有网站逐步添加这些特性，不需要重写。

## Service Worker 基础

Service Worker 是运行在浏览器后台的独立线程，拦截网络请求：

```
用户 → 页面 → Service Worker → 网络/缓存
```

### 注册

```javascript
// main.js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW 注册成功:", registration.scope);
      })
      .catch((error) => {
        console.log("SW 注册失败:", error);
      });
  });
}
```

### Service Worker 生命周期

```javascript
// sw.js

const CACHE_NAME = "my-app-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles/main.css",
  "/js/app.js",
  "/images/logo.png",
];

// 1. install：SW 首次安装时，预缓存静态资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()), // 跳过等待，立刻激活
  );
});

// 2. activate：清理旧版本缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()), // 立刻接管所有页面
  );
});

// 3. fetch：拦截网络请求
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 缓存命中，直接返回
      if (cachedResponse) return cachedResponse;

      // 缓存未命中，走网络
      return fetch(event.request);
    }),
  );
});
```

## 缓存策略

不同的资源适合不同的缓存策略：

**Cache First（缓存优先）**：适合静态资源（图片、字体、CSS/JS 文件）

```javascript
// 优先读缓存，缓存没有再走网络
async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}
```

**Network First（网络优先）**：适合 API 数据，保证最新，网络失败时降级到缓存

```javascript
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // 更新缓存
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request);
  }
}
```

**Stale While Revalidate（旧内容+后台更新）**：先返回缓存（快），同时在后台更新缓存。适合不要求严格最新的内容（新闻列表、用户头像）

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // 后台更新（不等待结果）
  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  });

  // 立刻返回缓存（或等待网络）
  return cached || fetchPromise;
}
```

## Web App Manifest

```json
// public/manifest.json
{
  "name": "我的应用",
  "short_name": "应用",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2196F3",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2196F3" />
```

## 用 Workbox 简化开发

手写 Service Worker 容易出错。Google 的 [Workbox](https://developers.google.com/web/tools/workbox) 提供了更高层的抽象：

```javascript
// sw.js（使用 Workbox）
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/3.0.0/workbox-sw.js",
);

// 预缓存（配合 webpack-plugin 自动生成文件列表）
workbox.precaching.precacheAndRoute(self.__precacheManifest || []);

// 路由规则
workbox.routing.registerRoute(
  /\.(?:png|gif|jpg|jpeg|svg)$/,
  workbox.strategies.cacheFirst({
    cacheName: "images",
    plugins: [new workbox.expiration.Plugin({ maxEntries: 60 })],
  }),
);

workbox.routing.registerRoute(/\/api\//, workbox.strategies.networkFirst());
```

## 实际效果

在我们的一个 ToC 项目上实施 PWA 后：

- 二次访问首屏时间从 2.1s 降到 0.3s（静态资源全部命中缓存）
- 弱网环境（2G）下页面依然可以打开（离线缓存）
- iOS 和 Android 用户可以"添加到主屏幕"，体验接近原生 App

---

_下一篇：Vuex 状态管理模式实践_
