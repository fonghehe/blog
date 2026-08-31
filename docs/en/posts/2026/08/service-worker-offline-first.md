---
title: "Service Worker and Offline-First Architecture: PWA Engineering Practices"
date: 2026-08-09 13:11:22
tags:
  - Engineering
  - PWA
readingTime: 9
description: "Service Worker is the only technology in the browser that can truly enable offline-first functionality. This article systematically covers the complete engineering approach to PWA offline-first architecture—from lifecycle, caching strategy matrix, Workbox engineering, push notifications, and background sync to update strategies—and discusses PWA's positioning and applicable scenarios in 2026."
wordCount: 1046
---

PWA (Progressive Web App) in 2026 is no longer the focus of "can it replace native apps" debates. App Store and Google Play remain dominant, but PWA has found its niche: no app-store updates required, works offline, and is instantly usable once installed. These characteristics keep PWA relevant in internal tools, content-focused applications, and emerging market scenarios. And PWA's technical foundation—the Service Worker—remains one of the most complex yet powerful APIs in the frontend.

## Service Worker Lifecycle and Event Model

A Service Worker is a separate thread running outside the browser's main thread, acting as a proxy between the web page and the network. It has its own lifecycle, completely independent from the page lifecycle.

```
Installing → Installed → Activating → Activated → Redundant
```

```typescript
// sw.ts - Service Worker entry
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// install event: precache critical resources
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

// activate event: clean up old caches
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
  // Immediately take over all pages (don't wait for page refresh)
  self.clients.claim();
});

// fetch event: intercept network requests
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Non-GET requests go straight to network
  if (request.method !== 'GET') return;

  // Different cache strategies for different resource types
  if (request.destination === 'document') {
    event.respondWith(handleNavigation(request));
  } else if (isStaticAsset(request.url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isApiRequest(request.url)) {
    event.respondWith(handleApiRequest(request));
  }
});
```

The key point in understanding the Service Worker lifecycle: **a new version of the Service Worker does not immediately replace the old one**. When a user first visits, v1 is installed. On the next visit, v2 is discovered and installed but not immediately activated—v1 is still controlling the current page. Only after all pages using v1 are closed will v2 activate. This is the core constraint in designing Service Worker update strategies.

## The Core Idea of Offline-First Architecture

Offline First is not "works offline too" but **treating cache as the primary data source and the network as the update mechanism**. The default behavior of traditional web applications is "network-first"—every request goes to the network, and failure means an error. Offline-first reverses this order: return data from cache first (instant response), then request the network in the background to update the cache.

The impact of this mindset shift is profound:

- Page load speed no longer depends on the network—near-instantaneous on cache hit
- Consistent user experience under unstable network—no white screen from disconnection
- Cache consistency needs to be handled—cached data may be stale

## Caching Strategy Matrix

Workbox provides five core caching strategies, each suited to different resource types:

```typescript
// Caching strategy mapping for different resources
const strategies = {
  // 1. Cache First: check cache first, return on hit, only fetch from network on miss
  // Suitable for: static assets (fonts, images, CSS/JS bundles)
  staticAssets: new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),

  // 2. Network First: try network first, update cache on success, fall back to cache on failure
  // Suitable for: dynamic content (API responses, HTML documents)
  dynamicContent: new NetworkFirst({
    cacheName: 'dynamic-content',
    networkTimeoutSeconds: 3, // 3-second timeout falls back to cache
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  }),

  // 3. Stale While Revalidate: return cache immediately, update cache in background
  // Suitable for: frequently updated resources where stale data is acceptable (e.g., user avatars, non-critical APIs)
  semiStatic: new StaleWhileRevalidate({
    cacheName: 'semi-static',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  }),

  // 4. Network Only: network only, no caching
  // Suitable for: non-cacheable data (e.g., real-time prices, sensitive operations)

  // 5. Cache Only: cache only, no network
  // Suitable for: offline pages, static asset fallback
};
```

The core of strategy selection is answering two questions: **is stale data acceptable** and **how frequently does the data update**.

| Resource Type | Stale OK? | Update Frequency | Recommended Strategy |
|--------------|-----------|-----------------|---------------------|
| JS/CSS bundle | Yes | Each deploy | Cache First |
| Font files | Yes | Very low | Cache First |
| HTML documents | Yes (offline fallback) | Medium | Network First |
| List APIs | Yes (short-term) | High | Stale While Revalidate |
| Real-time data APIs | No | Very high | Network Only |
| User write operations | N/A | N/A | Network Only + Background Sync |

## Engineering with Workbox

Manually writing Service Worker caching logic is error-prone. Workbox encapsulates this complexity into configurable modules. The standard practice in 2026 is integrating Workbox via a Vite plugin:

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
      registerType: 'prompt', // Prompt user to refresh when a new version is available
      injectRegister: false,

      // Inject precache manifest
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },

      // Disable in development
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
```

```typescript
// src/sw.ts - Custom Service Worker (using Workbox modules)
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache (manifest injected by Vite plugin)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigation requests: Network First + offline fallback page
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

// Static assets: Cache First
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

// Images: Stale While Revalidate
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

// API requests: Stale While Revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  }),
);
```

## Push Notifications

Push Notifications are the PWA capability that most closely approximates the native app experience. The complete chain involves: server-side VAPID key pair → user subscription → server push → Service Worker receipt → notification display.

```typescript
// Client: subscribe to push
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;

  // Check if already subscribed
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  // Get VAPID public key
  const vapidPublicKey = await fetch('/api/push/vapid-key').then((r) => r.text());
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // Must be true: pushes must display a notification
    applicationServerKey: convertedKey,
  });

  // Send subscription info to server
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
// Service Worker: handle push events
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
    tag: payload.tag, // Same-tag notifications replace each other to avoid piling up
    requireInteraction: payload.urgent ?? false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options),
  );
});

// Notification click: focus window or open URL
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // If an open window exists, focus it
      for (const client of allClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
```

A key limitation of push notifications: iOS Safari only supports Web Push from version 16.4 onward, and requires the user to first add the site to their home screen. This limits the reach of push notifications on iOS.

## Background Sync

Background Sync solves the problem of automatically retrying user actions performed while offline (such as sending messages or submitting forms) once the network is restored. This ensures data consistency—user actions aren't lost due to network interruptions.

```typescript
// Service Worker: background sync
const bgSyncPlugin = new BackgroundSyncPlugin('failed-requests', {
  maxRetentionTime: 24 * 60, // Retry retention for 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        // Notify client on success
        const clients = await self.clients.matchAll();
        clients.forEach((client) =>
          client.postMessage({ type: 'SYNC_SUCCESS', url: entry.request.url }),
        );
      } catch (error) {
        // Retry failed, put back in queue
        await queue.unshiftRequest(entry);
        throw error; // Throw error, Workbox will retry on next sync
      }
    }
  },
});

// Register background sync for POST requests
registerRoute(
  ({ request }) => request.method === 'POST',
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST',
);
```

```typescript
// Client: register background sync
async function submitForm(data: FormData) {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  } catch (error) {
    // Register background sync on network failure
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('submit-form');
      // Notify user: data will sync when network recovers
      showOfflineToast('Data saved, will sync automatically when network recovers');
    } else {
      // Browsers without Background Sync support fall back to local storage
      await saveToIndexedDB('pending-submits', data);
    }
  }
}
```

## Update Strategy: Getting Users the Latest Version

Service Worker updates are the most problematic aspect. After a new version is installed, it doesn't activate immediately, and users may keep using the old version. A well-designed update prompt flow is needed:

```typescript
// Client: Service Worker update management
class SWUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;

  async init() {
    if (!('serviceWorker' in navigator)) return;

    this.registration = await navigator.serviceWorker.register('/sw.js');

    // Listen for new Service Worker installation
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // Old version controlling the page → new version installed, waiting for activation
            this.showUpdatePrompt();
          }
          // Otherwise it's a first install, no prompt needed
        }
      });
    });

    // Listen for controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New Service Worker has taken over, refresh the page
      window.location.reload();
    });

    // Check for updates hourly
    setInterval(() => {
      this.registration?.update();
    }, 60 * 60 * 1000);
  }

  private showUpdatePrompt() {
    // Show update prompt UI
    const toast = createUpdateToast({
      message: 'A new version is available',
      actionText: 'Refresh',
      onAction: () => this.skipWaiting(),
    });
    document.body.appendChild(toast);
  }

  private skipWaiting() {
    // Tell the waiting Service Worker to activate immediately
    this.registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Service Worker: receive skip waiting message
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

Update strategy choice depends on the application type:

- **Content-focused apps**: Use `registerType: 'prompt'` to let users actively refresh
- **Tool-focused apps**: Use `registerType: 'autoUpdate'` to automatically update on next visit
- **Critical business apps**: Pair with a server API to check version compatibility, forcing updates when incompatible

## Debugging Tips

Chrome DevTools' Application panel is the core tool for debugging Service Workers:

- **Service Workers list**: View registered SW status, manually unregister, trigger updates
- **Cache Storage**: View cached content, manually delete cache entries
- **Offline / Update on reload / Bypass for network**: Three debug switches
  - `Offline`: Simulate being offline
  - `Update on reload`: Reinstall SW on every refresh (essential for development)
  - `Bypass for network`: SW doesn't intercept requests, useful for troubleshooting cache-related issues
- **Push messages**: Simulate pushes without a server

A common pitfall during development: modifying Service Worker code has no effect. The reason is `Update on reload` isn't enabled, so the old SW keeps controlling the page. Always enable this option during development.

## Integration with the App Shell Model

The App Shell model is a PWA architecture pattern: precache the application's "shell" (navigation bar, sidebar, layout framework) into the Service Worker. After the initial load, subsequent visits display the shell instantaneously, then dynamically fill in content with JS.

```typescript
// App Shell navigation route handling
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async () => {
    // Return cached app shell for navigation requests
    const cache = await caches.open('app-shell');
    const cached = await cache.match('/shell.html');

    if (cached) {
      // Update shell in background
      fetch('/shell.html').then((response) => {
        cache.put('/shell.html', response.clone());
      });
      return cached;
    }

    // First load: fetch from network
    const response = await fetch('/shell.html');
    cache.put('/shell.html', response.clone());
    return response;
  },
);
```

The App Shell model works best in SPAs—after the shell loads, client-side routing takes over, and page transitions generate no network requests. For SSR applications, however, the App Shell's value is limited because SSR itself already returns first-screen content quickly.

## PWA's Positioning in 2026

PWA in 2026 is no longer about "replacing native apps"—it's the optimal solution for specific scenarios:

- **Internal tools and enterprise apps**: No App Store review needed, distribute via URL directly
- **Emerging markets**: On low-end devices with limited networks, offline capability is a must
- **Content-focused apps**: News, blogs, documentation sites—offline reading is a natural need
- **High installation barrier scenarios**: Users unwilling to install an app for a low-frequency use case

Scenarios where PWA is not suitable: requiring extensive native APIs (Bluetooth, NFC, deep file system integration), requiring extremely high push notification delivery rates (iOS push is limited), or needing to appear in app store search results.

## Summary

The core of Service Worker and offline-first architecture lies in: understanding the caching strategy matrix and selecting strategies by resource characteristics, engineering cache management with Workbox, ensuring data consistency with Background Sync, improving user retention with push notifications, and designing a sensible update flow so users get new versions in a timely manner. PWA's positioning in 2026 is as the optimal solution for specific scenarios rather than a universal one—choosing PWA isn't because it's better than native apps, but because its distribution cost, update efficiency, and offline capabilities happen to match the business needs. Understanding the Service Worker lifecycle and caching strategies is the prerequisite for correctly implementing PWA, while debugging tips and update strategies are the guarantees for stable production operation.
