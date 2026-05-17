---
title: "PWA 入門：Service Worker のコア概念"
date: 2018-01-16 11:07:28
tags:
  - PWA
readingTime: 2
description: "PWA（Progressive Web App）は、Web アプリをネイティブアプリのように感じさせる技術セットです：オフラインサポート、プッシュ通知、ホーム画面へのインストール。コアとなる技術は Service Worker です。"
---

PWA（Progressive Web App）は、Web アプリをネイティブアプリのように感じさせる技術セットです：オフラインサポート、プッシュ通知、ホーム画面へのインストール。コアとなる技術は Service Worker です。

## Service Worker とは

Service Worker は Web ページとは独立してバックグラウンドで実行される JavaScript ファイルです。**ブラウザとネットワークの間のプロキシ**として機能し、リクエストを傍受してキャッシュから提供するかネットワークから取得するかを決定します。

主な特徴：

- 独自のスレッドで実行（ページをブロックしない）
- DOM へのアクセスなし
- HTTPS（または開発用 localhost）が必要
- 独自のライフサイクル（install → activate → アイドル）

## 基本的な登録

```javascript
// main.js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW 登録完了:", registration.scope);
      })
      .catch((error) => {
        console.error("SW 登録失敗:", error);
      });
  });
}
```

## Service Worker のライフサイクル

### インストールフェーズ：静的アセットのキャッシュ

```javascript
const CACHE_NAME = "my-app-v1";
const STATIC_ASSETS = ["/", "/css/main.css", "/js/main.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});
```

### アクティベートフェーズ：古いキャッシュの削除

```javascript
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
  self.clients.claim();
});
```

### フェッチフェーズ：ネットワークリクエストの傍受

```javascript
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    }),
  );
});
```

## キャッシュ戦略

**キャッシュファースト**（静的アセット）

```javascript
caches.match(request) || fetch(request);
```

**ネットワークファースト**（API リクエスト）

```javascript
fetch(request).catch(() => caches.match(request));
```

**Stale While Revalidate**（鮮度と速度のバランス）

```javascript
const cached = await caches.match(request);
const fetchPromise = fetch(request).then((response) => {
  cache.put(request, response.clone());
  return response;
});
return cached || fetchPromise;
```

## Web App マニフェスト

「ホーム画面に追加」機能のために：

```json
{
  "name": "マイアプリ",
  "short_name": "App",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4285f4",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" }
  ]
}
```

## 実際のプロジェクトでは Workbox を使用

SW を一から書くのはエラーが発生しやすいです。Google の [Workbox](https://developers.google.com/web/tools/workbox) が一般的な戦略をカプセル化しています：

```javascript
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new StaleWhileRevalidate({ cacheName: "api-cache" }),
);
```
