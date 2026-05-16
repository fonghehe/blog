---
title: "PWA Introduction: Core Concepts of Service Workers"
date: 2018-01-16 11:07:28
tags:
  - PWA
readingTime: 2
description: "PWA (Progressive Web App) is a set of techniques that make web apps feel more like native apps: offline support, push notifications, home screen installation. T"
---

PWA (Progressive Web App) is a set of techniques that make web apps feel more like native apps: offline support, push notifications, home screen installation. The core technology is the Service Worker.

## What Is a Service Worker

A Service Worker is a JavaScript file that runs in the background, independent of the web page. It acts as a **proxy between the browser and the network**, intercepting requests and deciding whether to serve from cache or fetch from the network.

Key characteristics:

- Runs in its own thread (doesn't block the page)
- No access to the DOM
- Must run on HTTPS (or localhost for development)
- Has its own lifecycle (install → activate → idle)

## Basic Registration

```javascript
// main.js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered:", registration.scope);
      })
      .catch((error) => {
        console.error("SW registration failed:", error);
      });
  });
}
```

The path `/sw.js` determines the SW's **scope** — it can only intercept requests within its directory.

## Service Worker Lifecycle

### Install Phase: Cache Static Assets

```javascript
// sw.js
const CACHE_NAME = "my-app-v1";
const STATIC_ASSETS = ["/", "/css/main.css", "/js/main.js", "/images/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting(); // activate immediately, don't wait for old SW to be gone
});
```

### Activate Phase: Clean Old Caches

```javascript
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  self.clients.claim(); // take control of existing pages immediately
});
```

### Fetch Phase: Intercept Network Requests

```javascript
self.addEventListener("fetch", (event) => {
  event.respondWith(
    // Cache First strategy
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    }),
  );
});
```

## Caching Strategies

**Cache First** (static assets)

```javascript
caches.match(request) || fetch(request);
```

**Network First** (API requests)

```javascript
fetch(request).catch(() => caches.match(request));
```

**Stale While Revalidate** (balance between freshness and speed)

```javascript
const cached = await caches.match(request);
const fetchPromise = fetch(request).then((response) => {
  cache.put(request, response.clone());
  return response;
});
return cached || fetchPromise;
```

## Web App Manifest

For the "Add to Home Screen" feature:

```json
// manifest.json
{
  "name": "My App",
  "short_name": "App",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fff",
  "theme_color": "#4285f4",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```html
<link rel="manifest" href="/manifest.json" />
```

## Use Workbox in Real Projects

Writing SW from scratch is error-prone. Google's [Workbox](https://developers.google.com/web/tools/workbox) encapsulates common strategies:

```javascript
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst } from "workbox-strategies";

// Pre-cache build output
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new StaleWhileRevalidate({ cacheName: "api-cache" }),
);
```
