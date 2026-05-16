---
title: "Vue CLI 3 Beta: First Impressions"
date: 2018-06-07 10:24:17
tags:
  - Vue
readingTime: 2
description: "Vue CLI 3 just released its Beta, and it's very different from the previous CLI 2. Here are my impressions after trying it out."
---

Vue CLI 3 just released its Beta, and it's very different from the previous CLI 2. Here are my impressions after trying it out.

## The Biggest Change: Zero Configuration

CLI 2 required manually maintaining `webpack.config.js` — the file was long and hard to understand. CLI 3 fully encapsulates the webpack config so everything works out of the box:

```bash
npm install -g @vue/cli
vue create my-app
cd my-app
npm run serve
```

That's it — no touching webpack config needed at all.

## Configuration: vue.config.js

If you need customization, create `vue.config.js` in the project root:

```javascript
// vue.config.js
module.exports = {
  // Public path
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // Dev server proxy
  devServer: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },

  // Merge webpack config
  configureWebpack: {
    plugins: [new MyPlugin()],
  },

  // Chain-modify webpack config
  chainWebpack: (config) => {
    config.plugin("html").tap((args) => {
      args[0].title = "My App";
      return args;
    });
  },
};
```

## Plugin System

A major highlight of CLI 3 is its plugin-based architecture. Adding features no longer means manually editing config — you install a plugin:

```bash
vue add router      # Add Vue Router
vue add vuex        # Add Vuex
vue add element-ui  # Add Element UI
vue add pwa         # Add PWA support
vue add typescript  # Add TypeScript
```

Plugins automatically modify the project structure and config — no manual changes required.

## Environment Variables

```bash
# .env.production
VUE_APP_API_URL=https://api.example.com
VUE_APP_VERSION=1.0.0
```

Access them in code with `process.env.VUE_APP_*` (only variables prefixed with `VUE_APP_` are exposed to the client).

## GUI Interface

CLI 3 also includes a web-based UI (!):

```bash
vue ui
```

Open your browser and you can manage plugins, run scripts, and view build analysis. Very friendly for people who aren't comfortable with the command line.

## Migrating from CLI 2

There's currently no automatic migration tool for old projects. The recommendation is to use CLI 3 for new projects. Old projects can continue with CLI 2 until the time is right to migrate.

## Summary

- Zero configuration — webpack is fully encapsulated, no manual maintenance needed
- `vue.config.js` provides a flexible configuration entry point
- `vue add` plugin command integrates features in one step
- The GUI interface is a highlight that lowers the barrier to entry
