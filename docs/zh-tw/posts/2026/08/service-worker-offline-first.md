---
title: "Service Worker 與離線優先架構：PWA 的工程實踐"
date: 2026-08-09 13:11:22
tags:
  - 工程化
  - PWA
readingTime: 10
description: "Service Worker 是瀏覽器中唯一能實現離線優先的技術基石。本文從生命週期、快取策略矩陣、Workbox 工程化、訊息推送、背景同步到更新策略，系統梳理 PWA 離線優先架構的完整工程方案，並討論 PWA 在 2026 年的定位和適用場景。"
wordCount: 1734
---

PWA（Progressive Web App）在 2026 年已經不再是「能不能替代原生 App」的討論焦點。App Store 和 Google Play 依然強勢，但 PWA 找到了自己的定位：不需要分發管道更新、離線場景可用、安裝即用。這些特性讓 PWA 在內部工具、內容型應用、新興市場場景中持續發揮作用。而 PWA 的技術基石——Service Worker——依然是前端最複雜也最強大的 API 之一。

## Service Worker 的生命週期和事件模型

Service Worker 是執行在瀏覽器主執行緒之外的獨立執行緒，充當網頁和網路之間的代理。它有自己的生命週期，與頁面生命週期完全獨立。

```
安裝中 (installing) → 安裝完成 (installed) → 激活中 (activating) → 激活完成 (activated) → 廢棄 (redundant)
```

```typescript
// sw.ts - Service Worker 入口
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// install 事件：預快取關鍵資源
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        '/',
        '/offline.html',
        '/styles/main.css',
        '/scripts/app.js',
        '/images/logo.svg',
      ]),
    ),
  );
});

// activate 事件：清理舊快取
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_VERSION))
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  // 立即接管所有頁面（不等頁面重新整理）
  self.clients.claim();
});

// fetch 事件：攔截網路請求
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // 非 GET 請求直接走網路
  if (request.method !== 'GET') return;

  // 不同資源用不同快取策略
  if (request.destination === 'document') {
    event.respondWith(handleNavigation(request));
  } else if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isApiRequest(request.url)) {
    event.respondWith(handleApiRequest(request));
  }
});
```

理解 Service Worker 生命週期的關鍵點：**新版本的 Service Worker 不會立即替換舊版本**。當使用者首次造訪時安裝 v1，下次造訪發現 v2 會安裝 v2 但不會立即啟用——v1 仍在控制當前頁面。只有當所有使用 v1 的頁面都關閉後，v2 才會啟用。這是 Service Worker 更新策略設計的核心約束。

## 離線優先架構的核心思想

離線優先（Offline First）不是「離線也能用」，而是**把快取作為首要資料來源，網路作為更新手段**。傳統 Web 應用的預設行為是「網路優先」——每次請求都打網路，網路失敗才報錯。離線優先把這個順序倒過來：先從快取返回資料（立即回應），同時在背景請求網路更新快取。

這個思維轉變的影響是深遠的：

- 頁面載入速度不再依賴網路——快取命中時近乎瞬時
- 網路不穩定場景下使用者體驗一致——不會因為斷網而白屏
- 需要處理快取一致性問題——快取資料可能過期

## 快取策略矩陣

Workbox 提供了五種核心快取策略，每種適用於不同的資源型別：

```typescript
// 不同資源的快取策略對映
const strategies = {
  // 1. Cache First：先查快取，快取命中直接返回，未命中才查網路
  // 適用：靜態資源（字體、圖片、CSS/JS bundle）
  staticAssets: new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
      }),
    ],
  }),

  // 2. Network First：先查網路，成功則更新快取，失敗則用快取
  // 適用：動態內容（API 回應、HTML 文件）
  dynamicContent: new NetworkFirst({
    cacheName: 'dynamic-content',
    networkTimeoutSeconds: 3, // 3 秒超時降級到快取
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 天
      }),
    ],
  }),

  // 3. Stale While Revalidate：立即返回快取，同時背景更新快取
  // 適用：頻繁更新但舊資料可用的資源（如使用者頭像、非關鍵 API）
  semiStatic: new StaleWhileRevalidate({
    cacheName: 'semi-static',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 天
      }),
    ],
  }),

  // 4. Network Only：只走網路，不快取
  // 適用：不可快取的資料（如即時價格、敏感操作）

  // 5. Cache Only：只走快取，不查網路
  // 適用：離線頁面、靜態資源兜底
};
```

策略選型的核心是回答兩個問題：**舊資料能不能用** 和 **資料更新頻率多高**。

| 資源型別 | 舊資料可用？ | 更新頻率 | 推薦策略 |
|---------|------------|---------|---------|
| JS/CSS bundle | 可以 | 每次部署 | Cache First |
| 字體檔案 | 可以 | 極低 | Cache First |
| HTML 文件 | 可以（離線兜底） | 中 | Network First |
| 列表 API | 可以（短期） | 高 | Stale While Revalidate |
| 即時資料 API | 不可以 | 極高 | Network Only |
| 使用者操作寫入 | 不適用 | N/A | Network Only + 背景同步 |

## Workbox 的工程化使用

手動寫 Service Worker 的快取邏輯容易出錯，Workbox 把這些複雜性封裝成了可設定的模組。2026 年的標準做法是用 Vite 外掛整合 Workbox：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt', // 有新版本時提示使用者重新整理
      injectRegister: false,

      // 注入預快取清單
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },

      // 開發環境停用
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
```

```typescript
// src/sw.ts - 自訂 Service Worker（使用 Workbox 模組）
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// 預快取（清單由 Vite 外掛注入）
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 導航請求：Network First + 離線兜底頁
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
  {
    denylist: [/^\/api/, /^\/admin/],
  },
);
registerRoute(navigationRoute);

// 靜態資源：Cache First
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// 圖片：Stale While Revalidate
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);

// API 請求：Stale While Revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 分鐘
      }),
    ],
  }),
);
```

## 訊息推送（Push Notification）

Push Notification 是 PWA 最接近原生 App 體驗的能力。完整鏈路涉及：伺服器端 VAPID 密鑰對 → 使用者訂閱 → 伺服器端推送 → Service Worker 接收 → 顯示通知。

```typescript
// 客戶端：訂閱推送
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;

  // 檢查是否已訂閱
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  // 取得 VAPID 公鑰
  const vapidPublicKey = await fetch('/api/push/vapid-key').then((r) => r.text());
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // 必須為 true：推送必須顯示通知
    applicationServerKey: convertedKey,
  });

  // 將訂閱資訊傳送到伺服器端
  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' },
  });

  return subscription;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split('').map((c) => c.charCodeAt(0)));
}
```

```typescript
// Service Worker：處理推送事件
self.addEventListener('push', (event: PushEvent) => {
  const payload = event.data?.json() ?? {};

  const options: NotificationOptions = {
    body: payload.body,
    icon: '/images/icon-192.png',
    badge: '/images/badge-72.png',
    data: {
      url: payload.url,
    },
    actions: payload.actions ?? [],
    tag: payload.tag, // 同 tag 的通知會替換，避免堆積
    requireInteraction: payload.urgent ?? false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options),
  );
});

// 通知點擊：聚焦視窗或打開 URL
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // 如果已有打開的視窗，聚焦它
      for (const client of allClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // 否則打開新視窗
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
```

推送通知的一個關鍵限制：iOS Safari 在 16.4 之後才支援 Web Push，且需要使用者先將網站新增到主畫面。這限制了推送通知在 iOS 上的覆蓋面。

## 背景同步（Background Sync）

背景同步解決的問題是：使用者離線時執行的操作（如發送訊息、提交表單）在恢復網路後自動重試。這保障了資料一致性——使用者的操作不會因為網路中斷而遺失。

```typescript
// Service Worker：背景同步
const bgSyncPlugin = new BackgroundSyncPlugin('failed-requests', {
  maxRetentionTime: 24 * 60, // 重試保留 24 小時
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        // 成功後通知客戶端
        const clients = await self.clients.matchAll();
        clients.forEach((client) =>
          client.postMessage({ type: 'SYNC_SUCCESS', url: entry.request.url }),
        );
      } catch (error) {
        // 重試失敗，放回佇列
        await queue.unshiftRequest(entry);
        throw error; // 拋出錯誤，Workbox 會在下次同步時重試
      }
    }
  },
});

// 註冊 POST 請求的背景同步
registerRoute(
  ({ request }) => request.method === 'POST',
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST',
);
```

```typescript
// 客戶端：註冊背景同步
async function submitForm(data: FormData) {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  } catch (error) {
    // 網路失敗時註冊背景同步
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('submit-form');
      // 通知使用者：資料將在網路恢復後同步
      showOfflineToast('資料已儲存，網路恢復後將自動同步');
    } else {
      // 不支援 Background Sync 的瀏覽器降級到本地儲存
      await saveToIndexedDB('pending-submits', data);
    }
  }
}
```

## 更新策略：讓使用者取得最新版本

Service Worker 的更新是最容易出問題的環節。新版本安裝後不會立即啟用，使用者可能一直使用舊版本。需要設計一個更新提示流程：

```typescript
// 客戶端：Service Worker 更新管理
class SWUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;

  async init() {
    if (!('serviceWorker' in navigator)) return;

    this.registration = await navigator.serviceWorker.register('/sw.js');

    // 監聽新 Service Worker 安裝
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // 已有舊版本在控制頁面 → 新版本已安裝，等待啟用
            this.showUpdatePrompt();
          }
          // 否則是首次安裝，不需要提示
        }
      });
    });

    // 監聽控制權變化
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // 新 Service Worker 已接管，重新整理頁面
      window.location.reload();
    });

    // 每小時檢查一次更新
    setInterval(() => {
      this.registration?.update();
    }, 60 * 60 * 1000);
  }

  private showUpdatePrompt() {
    // 顯示更新提示 UI
    const toast = createUpdateToast({
      message: '有新版本可用',
      actionText: '重新整理',
      onAction: () => this.skipWaiting(),
    });
    document.body.appendChild(toast);
  }

  private skipWaiting() {
    // 通知等待中的 Service Worker 立即啟用
    this.registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Service Worker 端：接收 skip waiting 訊息
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

更新策略的選擇取決於應用型別：

- **內容型應用**：用 `registerType: 'prompt'`，讓使用者主動重新整理
- **工具型應用**：用 `registerType: 'autoUpdate'`，下次造訪自動更新
- **關鍵業務應用**：搭配伺服器端 API 檢查版本相容性，不相容時強制更新

## 除錯技巧

Chrome DevTools 的 Application 面板是除錯 Service Worker 的核心工具：

- **Service Workers 列表**：查看已註冊的 SW 狀態、手動 unregister、觸發 update
- **Cache Storage**：查看快取內容、手動刪除快取條目
- **Offline / Update on reload / Bypass for network**：三個除錯開關
  - `Offline`：模擬離線
  - `Update on reload`：每次重新整理都重新安裝 SW（開發必備）
  - `Bypass for network`：SW 不攔截請求，便於排查是否是快取導致的問題
- **Push messages**：模擬推送，不需要伺服器端

開發時常見的坑：修改 Service Worker 程式碼後不生效。原因是 `Update on reload` 沒開，舊 SW 一直在控制頁面。開發階段始終開啟這個選項。

## 與 App Shell 模型的結合

App Shell 模型是 PWA 的一種架構模式：把應用的「外殼」（導航欄、側邊欄、佈局框架）預快取到 Service Worker，首次載入後後續造訪瞬時顯示外殼，再用 JS 動態填充內容。

```typescript
// App Shell 的導航路由處理
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async () => {
    // 導航請求返回快取的 app shell
    const cache = await caches.open('app-shell');
    const cached = await cache.match('/shell.html');

    if (cached) {
      // 背景更新 shell
      fetch('/shell.html').then((response) => {
        cache.put('/shell.html', response.clone());
      });
      return cached;
    }

    // 首次載入：從網路取得
    const response = await fetch('/shell.html');
    cache.put('/shell.html', response.clone());
    return response;
  },
);
```

App Shell 模型在 SPA 中效果最好——Shell 載入後由客戶端路由接管，頁面切換不產生網路請求。但對於 SSR 應用，App Shell 的價值有限，因為 SSR 本身已經能快速返回首屏內容。

## PWA 在 2026 年的定位

2026 年的 PWA 不再是「替代原生 App」的敘事，而是特定場景的最優解：

- **內部工具和企業應用**：不需要經過 App Store 審核，直接分發 URL
- **新興市場**：低端裝置和有限網路環境下，離線能力是剛需
- **內容型應用**：新聞、部落格、文件站，離線閱讀是自然需求
- **安裝門檻高的場景**：使用者不願意為一個低頻應用安裝 App

PWA 不適合的場景：需要大量原生 API（藍牙、NFC、檔案系統深度整合）、對推送通知到達率要求極高（iOS 推送受限）、需要出現在應用商店搜尋結果中。

## 小結

Service Worker 和離線優先架構的核心在於：理解快取策略矩陣並按資源特性選擇策略，用 Workbox 工程化快取管理，用 Background Sync 保障資料一致性，用推送通知提升使用者回訪，設計合理的更新流程讓使用者及時取得新版本。PWA 在 2026 年的定位是特定場景的最優解而非萬能方案——選擇 PWA 不是因為它比原生 App 更好，而是因為它的分發成本、更新效率和離線能力恰好匹配業務需求。理解 Service Worker 的生命週期和快取策略是正確實現 PWA 的前提，而除錯技巧和更新策略則是生產環境穩定執行的保障。
