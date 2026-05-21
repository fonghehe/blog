---
title: "Webpack Multi-Environment Variable Configuration"
date: 2018-05-17 15:30:37
tags:
  - Webpack
readingTime: 1
description: "Most projects have at least three environments — development, test, and production — each with different API URLs, log levels, and feature flags. Here's how to "
wordCount: 121
---

Most projects have at least three environments — development, test, and production — each with different API URLs, log levels, and feature flags. Here's how to manage them cleanly.

## Option 1: .env Files (with dotenv)

```
.env                # base variables shared across all environments
.env.development    # development environment
.env.test           # test environment
.env.production     # production environment
```

```bash
# .env
APP_NAME=My App

# .env.development
API_BASE_URL=http://localhost:3000
LOG_LEVEL=debug

# .env.production
API_BASE_URL=https://api.example.com
LOG_LEVEL=error
```

Vue CLI projects read these files automatically. Variables prefixed with `VUE_APP_` are injected into code:

```bash
# .env.development
VUE_APP_API_URL=http://localhost:3000
```

```javascript
// Using it in code
const baseURL = process.env.VUE_APP_API_URL;
```

## Option 2: Webpack DefinePlugin

For projects that don't use Vue CLI, inject variables with `DefinePlugin`:

```javascript
// webpack.config.js
const webpack = require("webpack");

const ENV = process.env.NODE_ENV || "development";
const envConfig = require(`./config/${ENV}.js`);

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(ENV),
      "process.env.API_URL": JSON.stringify(envConfig.apiUrl),
      __DEV__: ENV === "development",
    }),
  ],
};
```

```javascript
// config/development.js
module.exports = {
  apiUrl: "http://localhost:3000",
  enableDevtools: true,
};

// config/production.js
module.exports = {
  apiUrl: "https://api.example.com",
  enableDevtools: false,
};
```

## Option 3: Multiple Webpack Config Files

```
webpack.common.js     # shared config
webpack.dev.js        # development config
webpack.prod.js       # production config
```

```javascript
// webpack.common.js
const path = require("path");
module.exports = {
  entry: "./src/index.js",
  output: { path: path.resolve(__dirname, "dist") },
};

// webpack.dev.js
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  devServer: { port: 8080 },
});

// webpack.prod.js
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = merge(common, {
  mode: "production",
  optimization: { minimize: true },
});
```

```json
// package.json
{
  "scripts": {
    "dev": "webpack --config webpack.dev.js",
    "build": "webpack --config webpack.prod.js",
    "build:test": "NODE_ENV=test webpack --config webpack.prod.js"
  }
}
```

## Using Environment Variables in Code

```javascript
// api.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  timeout: 10000,
});

// Log requests in development
if (process.env.NODE_ENV === "development") {
  api.interceptors.request.use((config) => {
    console.log("[API Request]", config.method?.toUpperCase(), config.url);
    return config;
  });
}

export default api;
```

## Security Notes

```
❌ Never put these in frontend env vars:
  - Database passwords
  - API keys (with permissions)
  - Private keys

✅ Safe to put in frontend env vars:
  - API base URLs
  - Feature flags
  - Public third-party service IDs (e.g. map service key, analytics ID)
```

Frontend JS code is visible to anyone who inspects the bundle.

## Summary

- Vue CLI projects: use `.env.*` files with `VUE_APP_` prefix
- Custom Webpack: use `DefinePlugin` + multiple config files
- `webpack-merge` merges configs — avoids repetition
- Never put sensitive info in frontend environment variables
