---
title: "Micro-Frontend in Practice: Using single-spa"
date: 2019-07-12 10:26:31
tags:
  - Micro-Frontend
  - Engineering
readingTime: 2
description: "Our company's legacy backend system was a jQuery project from 2016. New features needed to be built with Vue, but a full rewrite wasn't feasible. Micro-frontend"
---

Our company's legacy backend system was a jQuery project from 2016. New features needed to be built with Vue, but a full rewrite wasn't feasible. Micro-frontends solved this problem.

## Our Scenario

- Legacy system: jQuery + Bootstrap, dozens of pages
- New requirement: new modules developed with Vue CLI 3
- Goal: coexist old and new, gradual migration, unified navigation

## Why We Chose single-spa

In 2019, there weren't many micro-frontend frameworks:

- single-spa: most mature, supports multiple frameworks
- qiankun (Alibaba): built on single-spa, friendlier API (not yet at 1.0 when we evaluated)

We ended up choosing single-spa.

## Architecture Design

```
Main App (Shell)
├── Shared navigation, auth, route registration
├── Sub-app A (Legacy jQuery) - /legacy/*
├── Sub-app B (Vue 2) - /orders/*
└── Sub-app C (Vue 2) - /analytics/*
```

## Main App (Shell)

```javascript
// shell/src/index.js
import { registerApplication, start } from "single-spa";

// Register legacy system (jQuery)
registerApplication(
  "legacy",
  () => import("./apps/legacy-app"),
  (location) => location.pathname.startsWith("/legacy"),
);

// Register Vue sub-apps
registerApplication(
  "orders",
  () => System.import("http://localhost:8081/orders-app.js"),
  (location) => location.pathname.startsWith("/orders"),
);

registerApplication(
  "analytics",
  () => System.import("http://localhost:8082/analytics-app.js"),
  (location) => location.pathname.startsWith("/analytics"),
);

start();
```

## Vue Sub-App Adapter

```javascript
// orders-app/src/main.js
import Vue from "vue";
import App from "./App.vue";
import router from "./router";

let vueInstance = null;

export async function bootstrap() {
  console.log("orders app bootstrapped");
}

export async function mount(props) {
  const { container, userInfo } = props;

  vueInstance = new Vue({
    router,
    render: (h) => h(App, { props: { userInfo } }),
  }).$mount(container || "#orders-container");
}

export async function unmount() {
  vueInstance.$destroy();
  vueInstance.$el.innerHTML = "";
  vueInstance = null;
}
```

## Style Isolation

```javascript
// Option 1: CSS Modules (recommended)
// Build-time class name hashing, naturally isolated

// Option 2: BEM naming convention
.orders-module__header { }
.orders-module__content { }

// Option 3: Shadow DOM (least intrusive, but no IE support)
```

## Inter-App Communication

```javascript
// shell/src/eventBus.js (global event bus)
class EventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  emit(event, data) {
    this.events[event]?.forEach((cb) => cb(data));
  }

  off(event, callback) {
    this.events[event] = this.events[event]?.filter((cb) => cb !== callback);
  }
}

window.__MICRO_APP_BUS__ = new EventBus();

// Usage in sub-apps
window.__MICRO_APP_BUS__.emit("user:logout", {});
window.__MICRO_APP_BUS__.on("theme:change", (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
});
```

## Pitfalls We Hit

1. **Global variable pollution**: Sub-apps must clean up registered global variables and event listeners when unmounting
2. **CSS global pollution**: Global styles from third-party UI libraries (Element UI) interfere with each other
3. **Routing conflicts**: Sub-app routes need `base` configuration to avoid clashing with the main app's routes
4. **Duplicate dependencies**: Each sub-app bundles Vue separately, increasing size. Use CDN to share

## Our Migration Roadmap

Phase 1 (3 months): New feature modules built in Vue, mounted via micro-frontend
Phase 2 (6 months): Gradually migrate high-traffic legacy pages to Vue sub-apps
Phase 3 (long-term): Once all legacy features are migrated, decommission the Legacy sub-app

## Summary

- Micro-frontends suit "gradual migration of large legacy systems" or "multi-team parallel development"
- single-spa's core is registering sub-apps and lifecycle hooks (bootstrap/mount/unmount)
- CSS Modules is recommended for style isolation; use a global event bus for inter-app communication
- Common pitfalls: global variable pollution, CSS pollution, routing conflicts
