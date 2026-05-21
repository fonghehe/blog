---
title: "Vue CLI 3 GA: In-Depth Usage Guide"
date: 2018-08-11 10:57:54
tags:
  - Vue
readingTime: 1
description: "Vue CLI 3.0 GA (General Availability) is officially released, graduating from Beta. It's significantly more stable than the Beta and ready for production use."
wordCount: 103
---

Vue CLI 3.0 GA (General Availability) is officially released, graduating from Beta. It's significantly more stable than the Beta and ready for production use.

## Project Structure Comparison

```
CLI 2 project structure:
├── build/                  ← webpack config files
│   ├── webpack.base.conf.js
│   ├── webpack.dev.conf.js
│   └── webpack.prod.conf.js
├── config/                 ← environment variable config
├── src/
└── package.json

CLI 3 project structure:
├── src/
├── public/                 ← static assets not processed by webpack
├── vue.config.js           ← optional, all config in a single file
└── package.json
```

Webpack config is fully internalized, making the project directory much cleaner.

## Complete vue.config.js Example

```javascript
const path = require("path");

module.exports = {
  // Deployment base path
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // Output directory
  outputDir: "dist",

  // Static asset directory (relative to outputDir)
  assetsDir: "static",

  // Dev server
  devServer: {
    port: 8080,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  },

  // CSS options
  css: {
    loaderOptions: {
      sass: {
        // Inject variables globally — no manual import needed in each .vue file
        prependData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // Modify webpack config
  chainWebpack: (config) => {
    // Modify html-webpack-plugin config
    config.plugin("html").tap((args) => {
      args[0].title = "My App";
      return args;
    });

    // Add path aliases
    config.resolve.alias
      .set("@", path.resolve(__dirname, "src"))
      .set("components", path.resolve(__dirname, "src/components"));
  },

  configureWebpack: {
    // Webpack config to merge directly
    performance: {
      hints: process.env.NODE_ENV === "production" ? "warning" : false,
    },
  },
};
```

## Environment Variables

```bash
# .env                   # All environments
# .env.local             # Local, not committed to git
# .env.development       # Development environment
# .env.production        # Production environment

VUE_APP_API_URL=https://api.example.com
VUE_APP_TITLE=My App
```

In code: `process.env.VUE_APP_API_URL`

## Multi-Page Configuration

```javascript
module.exports = {
  pages: {
    index: {
      entry: "src/main.js",
      template: "public/index.html",
      filename: "index.html",
      title: "Home",
    },
    admin: {
      entry: "src/admin/main.js",
      template: "public/admin.html",
      filename: "admin.html",
      title: "Admin Dashboard",
    },
  },
};
```

## Plugin Development

CLI 3's plugin system is powerful. Custom plugins can modify webpack, generate files, and add commands:

```javascript
// vue-cli-plugin-my-plugin/index.js
module.exports = (api, options) => {
  api.extendPackage({
    dependencies: { lodash: "^4.0.0" },
  });

  api.chainWebpack((config) => {
    // Modify webpack config
  });

  api.registerCommand("my-command", async () => {
    console.log("Running custom command");
  });
};
```

## Summary

- CLI 3 GA is safe to use in production
- `vue.config.js` centralizes all configuration, simpler than maintaining webpack files
- CSS `prependData` injects variables globally, no need to manually import in each component
- Multi-page configuration is very concise
