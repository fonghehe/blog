---
title: "PWA 漸進式 Web 應用入門：Service Worker 核心概念"
date: 2018-01-16 11:07:28
tags:
  - PWA
readingTime: 3
description: "PWA（Progressive Web App）這個概念 Google 在 2015 年提出，到 2018 年技術已經相當成熟，iOS 11.3 也終於加入了基礎的 Service Worker 支援。這篇文章從實際角度講 PWA 的核心機制。"
wordCount: 450
---

PWA（Progressive Web App）這個概念 Google 在 2015 年提出，到 2018 年技術已經相當成熟，iOS 11.3 也終於加入了基礎的 Service Worker 支援。這篇文章從實際角度講 PWA 的核心機制。

## PWA 不是一個具體的 API

很多人問「PWA 用什麼框架」，這個問題問錯方向了。PWA 是一組技術的集合，包括：

- **Service Worker**：網路代理，實現離線快取、推播通知
- **Web App Manifest**：讓應用程式可以「新增到主畫面」
- **HTTPS**：Service Worker 要求安全上下文
- **響應式設計**：在各種螢幕上良好顯示

你可以給任何現有網站逐步添加這些特性，不需要重寫。

## Service Worker 基礎

Service Worker 是執行在瀏覽器後台的獨立執行緒，攔截網路請求：

```
使用者 → 頁面 → Service Worker → 網路/快取
```

### 註冊

```javascript
// main.js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW 註冊成功:", registration.scope);
      })
      .catch((error) => {
        console.log("SW 註冊失敗:", error);
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

// 1. install：SW 首次安裝時，預先快取靜態資源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()), // 跳過等待，立刻啟用
  );
});

// 2. activate：清理舊版本快取
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

// 3. fetch：攔截網路請求
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 快取命中，直接返回
      if (cachedResponse) return cachedResponse;

      // 快取未命中，走網路
      return fetch(event.request);
    }),
  );
});
```

## 快取策略

不同的資源適合不同的快取策略：

**Cache First（快取優先）**：適合靜態資源（圖片、字型、CSS/JS 檔案）

```javascript
// 優先讀快取，快取沒有再走網路
async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}
```

**Network First（網路優先）**：適合 API 資料，保證最新，網路失敗時降級到快取

```javascript
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // 更新快取
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request);
  }
}
```

**Stale While Revalidate（舊內容＋背景更新）**：先返回快取（快），同時在背景更新快取。適合不要求嚴格最新的內容（新聞列表、使用者頭像）

```javascript
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // 背景更新（不等待結果）
  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  });

  // 立刻返回快取（或等待網路）
  return cached || fetchPromise;
}
```

## Web App Manifest

```json
// public/manifest.json
{
  "name": "我的應用程式",
  "short_name": "應用程式",
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

手寫 Service Worker 容易出錯。Google 的 [Workbox](https://developers.google.com/web/tools/workbox) 提供了更高層的抽象：

```javascript
// sw.js（使用 Workbox）
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/3.0.0/workbox-sw.js",
);

// 預先快取（配合 webpack-plugin 自動產生檔案清單）
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

在我們的一個 ToC 專案上實施 PWA 後：

- 二次訪問首屏時間從 2.1s 降到 0.3s（靜態資源全部命中快取）
- 弱網環境（2G）下頁面依然可以開啟（離線快取）
- iOS 和 Android 使用者可以「新增到主畫面」，體驗接近原生 App

---

_下一篇：Vuex 狀態管理模式實踐_
