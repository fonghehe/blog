---
title: "PWA 漸進式 Web 應用入門：Service Worker 核心概念"
date: 2018-01-16 11:07:28
tags:
  - PWA
readingTime: 3
description: "PWA（Progressive Web App）呢個概念 Google 喺 2015 年提出，到 2018 年技術已經相當成熟，iOS 11.3 都終於加入咗基礎嘅 Service Worker 支援。呢篇文章從實際角度講 PWA 嘅核心機制。"
wordCount: 447
---

PWA（Progressive Web App）呢個概念 Google 喺 2015 年提出，到 2018 年技術已經相當成熟，iOS 11.3 都終於加入咗基礎嘅 Service Worker 支援。呢篇文章從實際角度講 PWA 嘅核心機制。

## PWA 唔係一個具體嘅 API

好多人問「PWA 用咩框架」，呢個問題問錯方向喇。PWA 係一組技術嘅集合，包括：

- **Service Worker**：網絡代理，實現離線緩存、推送通知
- **Web App Manifest**：讓應用程序可以「添加到主屏幕」
- **HTTPS**：Service Worker 要求安全上下文
- **響應式設計**：喺各種屏幕上良好顯示

你可以俾任何現有網站逐步添加呢啲特性，唔需要重寫。

## Service Worker 基礎

Service Worker 係運行喺瀏覽器後台嘅獨立線程，攔截網絡請求：

```
用戶 → 頁面 → Service Worker → 網絡/緩存
```

### 注冊

```javascript
// main.js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW 注冊成功:", registration.scope);
      })
      .catch((error) => {
        console.log("SW 注冊失敗:", error);
      });
  });
}
```

### Service Worker 生命週期

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

// 1. install：SW 首次安裝時，預先緩存靜態資源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()), // 跳過等待，立刻激活
  );
});

// 2. activate：清理舊版本緩存
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
      .then(() => self.clients.claim()), // 立刻接管所有頁面
  );
});

// 3. fetch：攔截網絡請求
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 緩存命中，直接返回
      if (cachedResponse) return cachedResponse;

      // 緩存未命中，走網絡
      return fetch(event.request);
    }),
  );
});
```

## 緩存策略

唔同嘅資源適合唔同嘅緩存策略：

**Cache First（緩存優先）**：適合靜態資源（圖片、字體、CSS/JS 文件）

```javascript
// 優先讀緩存，緩存冇先走網絡
async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}
```

**Network First（網絡優先）**：適合 API 數據，保證最新，網絡失敗時降級到緩存

```javascript
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // 更新緩存
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request);
  }
}
```

**Stale While Revalidate（舊內容＋後台更新）**：先返回緩存（快），同時喺後台更新緩存。適合唔要求嚴格最新嘅內容（新聞列表、用戶頭像）

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // 後台更新（唔等待結果）
  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  });

  // 立刻返回緩存（或等待網絡）
  return cached || fetchPromise;
}
```

## Web App Manifest

```json
// public/manifest.json
{
  "name": "我嘅應用程序",
  "short_name": "應用",
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

## 用 Workbox 簡化開發

手寫 Service Worker 容易出錯。Google 嘅 [Workbox](https://developers.google.com/web/tools/workbox) 提供咗更高層嘅抽象：

```javascript
// sw.js（使用 Workbox）
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/3.0.0/workbox-sw.js",
);

// 預先緩存（配合 webpack-plugin 自動生成文件列表）
workbox.precaching.precacheAndRoute(self.__precacheManifest || []);

// 路由規則
workbox.routing.registerRoute(
  /\.(?:png|gif|jpg|jpeg|svg)$/,
  workbox.strategies.cacheFirst({
    cacheName: "images",
    plugins: [new workbox.expiration.Plugin({ maxEntries: 60 })],
  }),
);

workbox.routing.registerRoute(/\/api\//, workbox.strategies.networkFirst());
```

## 實際效果

喺我哋嘅一個 ToC 項目上實施 PWA 之後：

- 二次訪問首屏時間從 2.1s 降到 0.3s（靜態資源全部命中緩存）
- 弱網環境（2G）下頁面依然可以打開（離線緩存）
- iOS 同 Android 用戶可以「添加到主屏幕」，體驗接近原生 App

---

_下一篇：Vuex 狀態管理模式實踐_
