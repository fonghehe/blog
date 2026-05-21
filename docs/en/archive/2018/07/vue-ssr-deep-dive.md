---
title: "Deep Dive into Vue Server-Side Rendering (SSR)"
date: 2018-07-10 17:24:31
tags:
  - Vue
readingTime: 2
description: "I built an SSR project with Nuxt.js in the first half of the year. Using it was smooth, but when problems arose I didn't know where to start. After digging into"
wordCount: 227
---

I built an SSR project with Nuxt.js in the first half of the year. Using it was smooth, but when problems arose I didn't know where to start. After digging into Vue SSR's internals, here's a summary of the core mechanisms.

## SSR vs CSR Rendering Differences

**CSR (Client-Side Rendering):**

```
1. Browser requests HTML → server returns empty HTML
2. Browser loads JS → Vue runs on the client
3. Vue creates VNodes → diff → renders DOM
4. User sees content (time to first paint = JS execution time)
```

**SSR (Server-Side Rendering):**

```
1. Browser requests HTML → server runs Vue
2. Vue generates HTML string on the server → sends to browser
3. Browser displays HTML (first screen immediately visible)
4. Browser loads JS → Vue "takes over" existing DOM (Hydration)
5. Page becomes an interactive SPA
```

## Core API: vue-server-renderer

```javascript
{% raw %}
const Vue = require("vue");
const renderer = require("vue-server-renderer").createRenderer();

const app = new Vue({
  template: `<div>Hello, {{ name }}!</div>`,
  data: { name: "World" },
});

renderer.renderToString(app, (err, html) => {
  console.log(html);
  // <div data-server-rendered="true">Hello, World!</div>
});
{% endraw %}
```

The `data-server-rendered="true"` marker tells the client-side Vue that this DOM was server-rendered and can be reused without recreating it.

## Why You Need Separate Client and Server Entry Points

An SSR application needs two bundles:

**Server bundle** (Node.js environment):

- Handles SSR rendering requests
- No `window`, `document`, or other browser APIs
- Each request gets a fresh application instance (avoids state pollution)

**Client bundle** (browser environment):

- A normal SPA bundle
- Responsible for hydrating the server-rendered DOM
- Handles routing navigation, interactions, etc.

```javascript
// Application factory function (returns a new instance each call to avoid state pollution)
// app.js
import Vue from "vue";
import App from "./App.vue";
import createRouter from "./router";
import createStore from "./store";

export function createApp() {
  const router = createRouter();
  const store = createStore();

  const app = new Vue({
    router,
    store,
    render: (h) => h(App),
  });

  return { app, router, store };
}
```

```javascript
// entry-server.js
import { createApp } from "./app";

export default (context) => {
  return new Promise((resolve, reject) => {
    const { app, router, store } = createApp();

    router.push(context.url);

    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents();
      if (!matchedComponents.length) {
        return reject({ code: 404 });
      }

      // Call asyncData on components to fetch data
      Promise.all(
        matchedComponents.map((component) => {
          if (component.asyncData) {
            return component.asyncData({ store, route: router.currentRoute });
          }
        }),
      )
        .then(() => {
          // Embed store state in HTML (client uses it for initialization)
          context.state = store.state;
          resolve(app);
        })
        .catch(reject);
    }, reject);
  });
};
```

## Hydration: Client Takeover

During client initialization, Vue checks whether the server-rendered DOM matches the virtual DOM. If it matches, it reuses it without recreating:

```javascript
// entry-client.js
import { createApp } from "./app";

const { app, router, store } = createApp();

// Initialize store from server-embedded state
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__);
}

router.onReady(() => {
  app.$mount("#app"); // mount to existing DOM, triggers Hydration
});
```

## Common Issues

### 1. Using window/document in SSR

```javascript
// ❌ window doesn't exist on the server
if (window.innerWidth < 768) { ... }

// ✅ Check the runtime environment
if (typeof window !== 'undefined') {
  // browser only code
}

// ✅ Or put it in mounted (only runs on client)
mounted() {
  if (window.innerWidth < 768) { ... }
}
```

### 2. Hydration Mismatch

Inconsistent server/client render results cause hydration warnings:

```vue
{% raw %}
<!-- ❌ Content that depends on client state -->
<template>
  <div>{{ Date.now() }}</div>
  <!-- server and client times differ -->
</template>

<!-- ✅ Ensure consistency -->
<template>
  <div>{{ formattedDate }}</div>
</template>
<script>
export default {
  asyncData({ store }) {
    store.commit("SET_TIMESTAMP", Date.now());
  },
};
</script>
{% endraw %}
```

### 3. Third-party Library Compatibility

Many libraries assume a browser environment and crash in SSR. Solutions:

- Use conditional checks to skip server-side execution
- Use `ssr: false` plugins (Nuxt.js)

## Summary

- The core of SSR: server renders HTML string + client hydration
- Application must be written as a factory function, each request gets its own instance
