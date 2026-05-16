---
title: "Nuxt.js Server-Side Rendering Introduction: Why SSR"
date: 2018-02-08 09:53:07
tags:
  - Vue
readingTime: 3
description: "I recently used Nuxt.js for a project that needed SEO. Here's a summary of the basic SSR concepts and Nuxt's core usage."
---

I recently used Nuxt.js for a project that needed SEO. Here's a summary of the basic SSR concepts and Nuxt's core usage.

## Why SSR

A standard Vue SPA works like this:

```
Browser requests the page
→ Server returns empty HTML (just <div id="app"></div>)
→ Browser downloads the JS bundle
→ Vue renders on the client, fills in content
→ User sees the page
```

This causes two problems:

1. **Poor SEO**: search engine crawlers get empty HTML and can't see the content
2. **Slow first paint**: users have to wait for JS to download and execute before seeing anything

The SSR solution:

```
Browser requests the page
→ Server runs Vue, generates complete HTML
→ Returns HTML with content
→ User sees the page immediately (fast first paint)
→ JS loads, Vue takes over (Hydration)
→ Page becomes a normal SPA
```

## What Is Nuxt.js

Nuxt.js is a Vue-based SSR framework that hides the complexity of SSR configuration:

- Automatic routing (file-based)
- Built-in Vuex integration
- Automatic code splitting
- Static site generation (SSG) support

## Project Structure

```
nuxt-app/
├── pages/          ← page components, routes are auto-generated
│   ├── index.vue   → /
│   ├── about.vue   → /about
│   └── users/
│       └── _id.vue → /users/:id
├── layouts/        ← layout templates
│   └── default.vue
├── components/     ← regular components
├── store/          ← Vuex store
├── static/         ← static files
├── assets/         ← assets to be processed
└── nuxt.config.js  ← configuration file
```

## Core Concept: asyncData

The key SSR hook for fetching data on the server side:

```vue
{% raw %}
<template>
  <div>
    <h1>{{ post.title }}</h1>
    <p>{{ post.content }}</p>
  </div>
</template>

<script>
import axios from "axios";

export default {
  async asyncData({ params, error }) {
    try {
      const { data } = await axios.get(`/api/posts/${params.id}`);
      return { post: data };
    } catch (e) {
      error({ statusCode: 404, message: "Post not found" });
    }
  },
};
</script>
{% endraw %}
```

`asyncData` executes on the server and its returned data is merged with `data()`. The page HTML already contains this data, so search engines can index it.

Note: **You cannot use `this` inside `asyncData`** (the component hasn't been instantiated yet). Use the `context` argument to access route info, store, etc.

## fetch hook

`fetch` also runs on the server, but is used to populate the Vuex store:

```vue
<script>
export default {
  async fetch({ store, params }) {
    await store.dispatch("posts/fetchPost", params.id);
  },
};
</script>
```

## Dynamic Routes

Use `_` prefix in filenames to denote dynamic parameters:

```
pages/
├── users/
│   ├── index.vue      → /users
│   └── _id.vue        → /users/:id (dynamic)
```

```vue
<!-- pages/users/_id.vue -->
<script>
export default {
  async asyncData({ params }) {
    const userId = params.id;
    // ...
  },
};
</script>
```

## Common nuxt.config.js Options

```javascript
module.exports = {
  // Page head configuration
  head: {
    title: "My Site",
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "Site description" },
    ],
  },

  // Global CSS
  css: ["~/assets/main.scss"],

  // Plugins
  plugins: ["~/plugins/axios"],

  // Nuxt modules
  modules: ["@nuxtjs/axios"],

  // Build configuration
  build: {
    extend(config, ctx) {
      // Custom webpack configuration
    },
  },
};
```

## Static Site Generation (generate)

If you don't need real SSR and just want static HTML (blog use case):

```bash
npm run generate
```

Nuxt will request all pages at build time and generate static HTML files that can be deployed to a CDN.

```javascript
// nuxt.config.js - dynamic routes need to be declared for static generation
module.exports = {
  generate: {
    routes: async () => {
      const { data } = await axios.get("/api/posts");
      return data.map((post) => `/posts/${post.id}`);
    },
  },
};
```

## Pitfall: window is not defined

In an SSR environment (Node.js) there is no `window` object — using it directly will throw:

```javascript
// ❌ This will throw on the server
mounted() {
  // mounted only runs on the client, this is safe ✅
  window.addEventListener('resize', this.handleResize)
}

// ❌ This will throw
asyncData() {
  const width = window.innerWidth  // window doesn't exist on the server!
}
```

For libraries that can only be used on the client (e.g. DOM-manipulating libraries):

```javascript
// nuxt.config.js
plugins: [
  { src: "~/plugins/some-plugin", ssr: false }, // client-only
];
```

## Summary

Nuxt.js wraps SSR complexity very well and the convention-based file routing makes it easy to get started. `asyncData` is the core — understanding that it runs on both server and client is key. It's best suited for content-heavy sites that need SEO, such as e-commerce home pages.
