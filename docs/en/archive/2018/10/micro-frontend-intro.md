---
title: "Micro-frontend Introduction: When a Project Grows Too Big for One Person"
date: 2018-10-15 10:10:23
tags:
  - Micro-frontend
  - Engineering
readingTime: 6
description: "Our back-office management system was built with Vue 2 three years ago. It started with just a handful of pages and was a joy to work with. Three years later, i"
wordCount: 938
---

## Background

Our back-office management system was built with Vue 2 three years ago. It started with just a handful of pages and was a joy to work with. Three years later, it had become a monster:

- 50+ routed pages
- 200+ components
- 3 teams, 12 developers, all working on it simultaneously
- Webpack builds starting at 4 minutes
- The main bundle over 3 MB, with first-screen load getting slower and slower

Worst of all, every release was a full deployment. Changing a single word in the Orders module forced the entire system to be redeployed. Last week the Inventory module shipped a bug that took down the whole back-office — completely unrelated to our User module, but everyone's ticketing system crashed.

Someone on the team joked: "This project is already too big for any one person to manage." It wasn't really a joke.

## What Is a Micro-frontend?

The micro-frontend concept is essentially moving the backend microservices idea to the frontend.

The backend already went through the journey from monolith to microservices — splitting a large Java application into multiple independently deployable services, each with its own database and its own release cadence. The frontend is now reaching that same inflection point.

Core idea:

```
Traditional monolithic SPA:
┌─────────────────────────────────────┐
│        Monolithic Frontend App      │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ User │ │Order │ │Stock │        │
│  └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────┘
One repo, one build artifact, one deployment unit

Micro-frontend:
┌─────────────────────────────────────┐
│        Host App (Shell)             │
│  ┌──────────┐ ┌──────────┐          │
│  │ User App │ │Order App │          │
│  │ Own repo │ │ Own repo │          │
│  │ Own deploy│ │Own deploy│          │
│  └──────────┘ └──────────┘          │
└─────────────────────────────────────┘
Each module developed, built, and deployed independently
```

Each sub-app can have its own technology stack and its own release cycle, with teams working independently of one another.

## Comparing Available Approaches

Before starting, I spent a week researching several approaches.

### Option 1: iframe

The oldest and most direct approach. The host app provides the navigation shell; sub-apps load via iframe.

```html
<!-- Host app shell -->
<div id="layout">
  <sidebar-nav />
  <main>
    <iframe :src="currentAppUrl" frameborder="0"></iframe>
  </main>
</div>
```

Isolation is excellent — styles, JS, and global variables are completely independent. The downsides are equally obvious: route synchronization is painful, modals get clipped by the iframe boundary, inter-app communication is limited to `postMessage`, and the iframe loading experience is poor.

### Option 2: Nginx Route Dispatching

Route different paths to different frontend app deployments:

```nginx
location /user/ {
  proxy_pass http://user-app-server/;
}
location /order/ {
  proxy_pass http://order-app-server/;
}
```

Simple and blunt, but switching paths causes a full-page reload, degrading UX. Shared elements (navigation, user info) must be reimplemented in every sub-app.

### Option 3: npm Package Splitting

Extract shared modules as npm packages; each business team maintains their own repo and the host app assembles them.

This approach requires the least change to the build pipeline, but it doesn't actually solve independent deployment — whenever any module updates, the host app still needs a full rebuild and redeploy.

### Option 4: single-spa

A project called [single-spa](https://single-spa.js.org/) provides a runtime framework that lets multiple frontend apps coexist on the same page, coordinating mounting and unmounting through lifecycle management:

```javascript
import { registerApplication, start } from "single-spa";

registerApplication(
  "user-app",
  () => System.import("@org/user-app"),
  (location) => location.pathname.startsWith("/user"),
);

registerApplication(
  "order-app",
  () => System.import("@org/order-app"),
  (location) => location.pathname.startsWith("/order"),
);

start();
```

Sub-apps must expose `bootstrap`, `mount`, and `unmount` lifecycle hooks. The concept is good, but the community is still small, the documentation is sparse, and Vue support requires extra adapters. It feels like a promising direction, but the production risk is non-trivial right now.

## Our Attempt: iframe PoC

Given the team's current technical depth and risk tolerance, we decided to start with the most conservative iframe approach for a PoC — extracting the User Management module from the main app.

Overall architecture:

```
┌────────────────────────────────────────────┐
│  Host App Shell (Vue 2)                    │
│  ┌──────────────────────────────────────┐  │
│  │  Top Nav + Sidebar                   │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │  <iframe :src="userAppUrl" />        │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
        │                        │
        ▼                        ▼
   Host app deploy          User sub-app deploy
(Other 40+ pages)       (Vue 2, independent repo)
```

The key challenge was sharing the login state. Our approach: after login, the host app writes a token into a cookie scoped to `.company.com`; the sub-app reads it from the cookie:

```javascript
// Host app: after successful login
document.cookie = `auth_token=${token}; domain=.company.com; path=/`;

// Sub-app: read on startup
function getAuthToken() {
  const match = document.cookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

// Sub-app: attach the token to requests
axios.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Sub-apps communicate with each other via `postMessage`:

```javascript
// Host → Sub-app: pass user info
iframe.contentWindow.postMessage(
  { type: "USER_INFO", payload: { userId: 123, role: "admin" } },
  "https://user.company.com",
);

// Sub-app listening
window.addEventListener("message", (event) => {
  if (event.data.type === "USER_INFO") {
    store.commit("setUserInfo", event.data.payload);
  }
});

// Sub-app → Host: trigger a route navigation
window.parent.postMessage(
  { type: "NAVIGATE", payload: "/order/detail/456" },
  "https://admin.company.com",
);
```

## Pitfalls We Hit

We ran into several memorable issues during the PoC.

**1. iframe height auto-sizing**

An iframe doesn't stretch to fit its content by default. Setting `height: 100%` causes double scrollbars. Our fix: the sub-app uses `postMessage` to tell the host its content height:

```javascript
// Sub-app: notify the host whenever content height changes
const observer = new ResizeObserver(() => {
  window.parent.postMessage(
    { type: "RESIZE", height: document.body.scrollHeight },
    "*",
  );
});
observer.observe(document.body);

// Host: receive the height and set the iframe style
window.addEventListener("message", (event) => {
  if (event.data.type === "RESIZE") {
    iframe.style.height = event.data.height + "px";
  }
});
```

**2. Modals and overlays clipped**

Modals or toasts inside the iframe are constrained to the iframe boundary and cannot cover the full screen. This is the most frustrating problem with iframe-based micro-frontends. Our compromise: implement modals in the host app, and have sub-apps request modals via `postMessage`. This increases coupling, though.

**3. Browser back/forward**

Route changes inside the iframe are not captured by the browser history. We needed to sync routes between the host and sub-apps — the sub-app notifies the host on route change, the host updates a URL query parameter, and the iframe then navigates based on that query. It's convoluted and hard to maintain.

## When Should You Use Micro-frontends?

After all these pitfalls, is micro-frontend even worth it? It depends. It's genuinely not the right solution for every project.

**Good fit:**

- Multiple teams maintaining a large frontend app with frequent collaboration conflicts
- Different modules need independent releases to reduce deployment risk
- Progressively migrating a legacy system (e.g., from jQuery to Vue)
- Clear module boundaries with relatively simple cross-module interactions

**Poor fit:**

- The project is small enough for two or three people to maintain — don't over-engineer
- Modules have complex, tightly coupled interactions — the communication overhead after splitting will be high
- The team lacks the DevOps infrastructure to support multiple repos and multiple deployment pipelines

Put simply, micro-frontends solve an organizational problem (multi-team collaboration, independent delivery), not a purely technical one. If your team isn't being choked by a monolith, there's no rush to adopt micro-frontends.

## Summary

- Micro-frontends bring backend microservice thinking to the frontend, enabling large app modules to be developed, built, and deployed independently
- In 2018, the main approaches are: iframe, Nginx route dispatching, npm package splitting, and JS runtime integration
- The iframe approach is the simplest and offers the best isolation, but route syncing, modal clipping, and communication costs are hard limitations
- single-spa is a promising runtime integration framework, but it's still immature — worth watching but adopt cautiously
- Micro-frontends fundamentally solve team collaboration and independent delivery problems; small projects don't need them
- If you decide to move forward, start with a clearly bounded module as a PoC — don't split everything at once
