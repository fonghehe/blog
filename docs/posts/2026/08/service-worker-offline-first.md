---
title: "Service Worker 与离线优先架构：PWA 的工程实践"
date: 2026-08-09 13:11:22
tags:
  - 工程化
  - PWA
readingTime: 10
description: "Service Worker 是浏览器中唯一能实现离线优先的技术基石。本文从生命周期、缓存策略矩阵、Workbox 工程化、消息推送、后台同步到更新策略，系统梳理 PWA 离线优先架构的完整工程方案，并讨论 PWA 在 2026 年的定位和适用场景。"
wordCount: 1710
---

PWA（Progressive Web App）在 2026 年已经不再是"能不能替代原生 App"的讨论焦点。App Store 和 Google Play 依然强势，但 PWA 找到了自己的定位：无需经过分发渠道即可更新、可离线使用、安装即用。这些特性让 PWA 在内部工具、内容型应用、新兴市场场景中持续发挥作用。而 PWA 的技术基石——Service Worker——依然是前端最复杂也最强大的 API 之一。

## Service Worker 的生命周期和事件模型

Service Worker 是运行在浏览器主线程之外的独立线程，充当网页和网络之间的代理。它有自己的生命周期，与页面生命周期完全独立。

```
安装中 (installing) → 安装完成 (installed) → 激活中 (activating) → 激活完成 (activated) → 废弃 (redundant)
```

```typescript
// sw.ts - Service Worker 入口
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// install 事件：预缓存关键资源
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

// activate 事件：清理旧缓存
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
  // 立即接管所有页面（不等页面刷新）
  self.clients.claim();
});

// fetch 事件：拦截网络请求
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // 非 GET 请求直接走网络
  if (request.method !== 'GET') return;

  // 不同资源用不同缓存策略
  if (request.destination === 'document') {
    event.respondWith(handleNavigation(request));
  } else if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isApiRequest(request.url)) {
    event.respondWith(handleApiRequest(request));
  }
});
```

理解 Service Worker 生命周期的关键点：**新版本的 Service Worker 不会立即替换旧版本**。当用户首次访问时安装 v1，下次访问发现 v2 会安装 v2 但不会立即激活——v1 仍在控制当前页面。只有当所有使用 v1 的页面都关闭后，v2 才会激活。这是 Service Worker 更新策略设计的核心约束。

## 离线优先架构的核心思想

离线优先（Offline First）不是"离线也能用"，而是**把缓存作为首要数据源，网络作为更新手段**。传统 Web 应用的默认行为是"网络优先"——每次请求都打网络，网络失败才报错。离线优先把这个顺序倒过来：先从缓存返回数据（立即响应），同时在后台请求网络更新缓存。

这个思维转变的影响是深远的：

- 页面加载速度不再依赖网络——缓存命中时近乎瞬时
- 网络不稳定场景下用户体验一致——不会因为断网而白屏
- 需要处理缓存一致性问题——缓存数据可能过期

## 缓存策略矩阵

Workbox 提供了五种核心缓存策略，每种适用于不同的资源类型：

```typescript
// 不同资源的缓存策略映射
const strategies = {
  // 1. Cache First：先查缓存，缓存命中直接返回，未命中才查网络
  // 适用：静态资源（字体、图片、CSS/JS bundle）
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

  // 2. Network First：先查网络，成功则更新缓存，失败则用缓存
  // 适用：动态内容（API 响应、HTML 文档）
  dynamicContent: new NetworkFirst({
    cacheName: 'dynamic-content',
    networkTimeoutSeconds: 3, // 3 秒超时降级到缓存
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 天
      }),
    ],
  }),

  // 3. Stale While Revalidate：立即返回缓存，同时后台更新缓存
  // 适用：频繁更新但旧数据可用的资源（如用户头像、非关键 API）
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

  // 4. Network Only：只走网络，不缓存
  // 适用：不可缓存的数据（如实时价格、敏感操作）

  // 5. Cache Only：只走缓存，不查网络
  // 适用：离线页面、静态资源兜底
};
```

策略选型的核心是回答两个问题：**旧数据能不能用** 和 **数据更新频率多高**。

| 资源类型 | 旧数据可用？ | 更新频率 | 推荐策略 |
|---------|------------|---------|---------|
| JS/CSS bundle | 可以 | 每次部署 | Cache First |
| 字体文件 | 可以 | 极低 | Cache First |
| HTML 文档 | 可以（离线兜底） | 中 | Network First |
| 列表 API | 可以（短期） | 高 | Stale While Revalidate |
| 实时数据 API | 不可以 | 极高 | Network Only |
| 用户操作写入 | 不适用 | N/A | Network Only + 后台同步 |

## Workbox 的工程化使用

手动写 Service Worker 的缓存逻辑容易出错，Workbox 把这些复杂性封装成了可配置的模块。2026 年的标准做法是用 Vite 插件集成 Workbox：

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
      registerType: 'prompt', // 有新版本时提示用户刷新
      injectRegister: false,

      // 注入预缓存清单
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },

      // 开发环境禁用
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
```

```typescript
// src/sw.ts - 自定义 Service Worker（使用 Workbox 模块）
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// 预缓存（清单由 Vite 插件注入）
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 导航请求：Network First + 离线兜底页
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

// 静态资源：Cache First
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

// 图片：Stale While Revalidate
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

// API 请求：Stale While Revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 分钟
      }),
    ],
  }),
);
```

## 消息推送（Push Notification）

Push Notification 是 PWA 最接近原生 App 体验的能力。完整链路涉及：服务端 VAPID 密钥对 → 用户订阅 → 服务端推送 → Service Worker 接收 → 显示通知。

```typescript
// 客户端：订阅推送
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;

  // 检查是否已订阅
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  // 获取 VAPID 公钥
  const vapidPublicKey = await fetch('/api/push/vapid-key').then((r) => r.text());
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // 必须为 true：推送必须显示通知
    applicationServerKey: convertedKey,
  });

  // 将订阅信息发送到服务端
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
// Service Worker：处理推送事件
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
    tag: payload.tag, // 同 tag 的通知会替换，避免堆积
    requireInteraction: payload.urgent ?? false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options),
  );
});

// 通知点击：聚焦窗口或打开 URL
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // 如果已有打开的窗口，聚焦它
      for (const client of allClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // 否则打开新窗口
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
```

推送通知的一个关键限制：iOS Safari 在 16.4 之后才支持 Web Push，且需要用户先将网站添加到主屏幕。这限制了推送通知在 iOS 上的覆盖面。

## 后台同步（Background Sync）

后台同步解决的问题是：用户离线时执行的操作（如发送消息、提交表单）在恢复网络后自动重试。这保障了数据一致性——用户的操作不会因为网络中断而丢失。

```typescript
// Service Worker：后台同步
const bgSyncPlugin = new BackgroundSyncPlugin('failed-requests', {
  maxRetentionTime: 24 * 60, // 重试保留 24 小时
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        // 成功后通知客户端
        const clients = await self.clients.matchAll();
        clients.forEach((client) =>
          client.postMessage({ type: 'SYNC_SUCCESS', url: entry.request.url }),
        );
      } catch (error) {
        // 重试失败，放回队列
        await queue.unshiftRequest(entry);
        throw error; // 抛出错误，Workbox 会在下次同步时重试
      }
    }
  },
});

// 注册 POST 请求的后台同步
registerRoute(
  ({ request }) => request.method === 'POST',
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST',
);
```

```typescript
// 客户端：注册后台同步
async function submitForm(data: FormData) {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  } catch (error) {
    // 网络失败时注册后台同步
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('submit-form');
      // 通知用户：数据将在网络恢复后同步
      showOfflineToast('数据已保存，网络恢复后将自动同步');
    } else {
      // 不支持 Background Sync 的浏览器降级到本地存储
      await saveToIndexedDB('pending-submits', data);
    }
  }
}
```

## 更新策略：让用户获取最新版本

Service Worker 的更新是最容易出问题的环节。新版本安装后不会立即激活，用户可能一直使用旧版本。需要设计一个更新提示流程：

```typescript
// 客户端：Service Worker 更新管理
class SWUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;

  async init() {
    if (!('serviceWorker' in navigator)) return;

    this.registration = await navigator.serviceWorker.register('/sw.js');

    // 监听新 Service Worker 安装
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // 已有旧版本在控制页面 → 新版本已安装，等待激活
            this.showUpdatePrompt();
          }
          // 否则是首次安装，不需要提示
        }
      });
    });

    // 监听控制权变化
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // 新 Service Worker 已接管，刷新页面
      window.location.reload();
    });

    // 每小时检查一次更新
    setInterval(() => {
      this.registration?.update();
    }, 60 * 60 * 1000);
  }

  private showUpdatePrompt() {
    // 显示更新提示 UI
    const toast = createUpdateToast({
      message: '有新版本可用',
      actionText: '刷新',
      onAction: () => this.skipWaiting(),
    });
    document.body.appendChild(toast);
  }

  private skipWaiting() {
    // 通知等待中的 Service Worker 立即激活
    this.registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Service Worker 端：接收 skip waiting 消息
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

更新策略的选择取决于应用类型：

- **内容型应用**：用 `registerType: 'prompt'`，让用户主动刷新
- **工具型应用**：用 `registerType: 'autoUpdate'`，下次访问自动更新
- **关键业务应用**：配合服务端 API 检查版本兼容性，不兼容时强制更新

## 调试技巧

Chrome DevTools 的 Application 面板是调试 Service Worker 的核心工具：

- **Service Workers 列表**：查看已注册的 SW 状态、手动 unregister、触发 update
- **Cache Storage**：查看缓存内容、手动删除缓存条目
- **Offline / Update on reload / Bypass for network**：三个调试开关
  - `Offline`：模拟离线
  - `Update on reload`：每次刷新都重新安装 SW（开发必备）
  - `Bypass for network`：SW 不拦截请求，便于排查是否是缓存导致的问题
- **Push messages**：模拟推送，不需要服务端

开发时常见的坑：修改 Service Worker 代码后不生效。原因是 `Update on reload` 没开，旧 SW 一直在控制页面。开发阶段始终开启这个选项。

## 与 App Shell 模型的结合

App Shell 模型是 PWA 的一种架构模式：把应用的"外壳"（导航栏、侧边栏、布局框架）预缓存到 Service Worker，首次加载后后续访问瞬时显示外壳，再用 JS 动态填充内容。

```typescript
// App Shell 的导航路由处理
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async () => {
    // 导航请求返回缓存的 app shell
    const cache = await caches.open('app-shell');
    const cached = await cache.match('/shell.html');

    if (cached) {
      // 后台更新 shell
      fetch('/shell.html').then((response) => {
        cache.put('/shell.html', response.clone());
      });
      return cached;
    }

    // 首次加载：从网络获取
    const response = await fetch('/shell.html');
    cache.put('/shell.html', response.clone());
    return response;
  },
);
```

App Shell 模型在 SPA 中效果最好——Shell 加载后由客户端路由接管，页面切换不产生网络请求。但对于 SSR 应用，App Shell 的价值有限，因为 SSR 本身已经能快速返回首屏内容。

## PWA 在 2026 年的定位

2026 年的 PWA 不再是"替代原生 App"的叙事，而是特定场景的最优解：

- **内部工具和企业应用**：不需要经过 App Store 审核，直接分发 URL
- **新兴市场**：低端设备和有限网络环境下，离线能力是刚需
- **内容型应用**：新闻、博客、文档站，离线阅读是自然需求
- **安装门槛高的场景**：用户不愿意为一个低频应用安装 App

PWA 不适合的场景：需要大量原生 API（蓝牙、NFC、文件系统深度集成）、对推送通知到达率要求极高（iOS 推送受限）、需要出现在应用商店搜索结果中。

## 小结

Service Worker 和离线优先架构的核心在于：理解缓存策略矩阵并按资源特性选择策略，用 Workbox 工程化缓存管理，用 Background Sync 保障数据一致性，用推送通知提升用户回访，设计合理的更新流程让用户及时获取新版本。PWA 在 2026 年的定位是特定场景的最优解而非万能方案——选择 PWA 不是因为它比原生 App 更好，而是因为它的分发成本、更新效率和离线能力恰好匹配业务需求。理解 Service Worker 的生命周期和缓存策略是正确实现 PWA 的前提，而调试技巧和更新策略则是生产环境稳定运行的保障。
