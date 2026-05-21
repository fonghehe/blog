---
title: "Webpack 多環境變數配置"
date: 2018-05-17 15:30:37
tags:
  - Webpack
readingTime: 1
description: "專案裡有開發、測試、生產三套環境，API 地址不同、日誌級別不同、功能開關也不同。如何優雅地管理這些配置？"
wordCount: 197
---

專案裡有開發、測試、生產三套環境，API 地址不同、日誌級別不同、功能開關也不同。如何優雅地管理這些配置？

## 方案一：.env 檔案（配合 dotenv）

```
.env                # 所有環境共享的基礎變數
.env.development    # 開發環境
.env.test           # 測試環境
.env.production     # 生產環境
```

```bash
# .env
APP_NAME=我的應用

# .env.development
API_BASE_URL=http://localhost:3000
LOG_LEVEL=debug

# .env.production
API_BASE_URL=https://api.example.com
LOG_LEVEL=error
```

Vue CLI 專案自動讀取這些檔案，`VUE_APP_` 字首的變數會注入到程式碼裡：

```bash
# .env.development
VUE_APP_API_URL=http://localhost:3000
```

```javascript
// 在程式碼裡使用
const baseURL = process.env.VUE_APP_API_URL;
```

## 方案二：Webpack DefinePlugin

對於不用 Vue CLI 的專案，用 `DefinePlugin` 注入：

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

## 方案三：多份 webpack 配置

```
webpack.common.js     # 公共配置
webpack.dev.js        # 開發環境配置
webpack.prod.js       # 生產環境配置
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

## 在程式碼裡使用環境變數

```javascript
// api.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  timeout: 10000,
});

// 開發環境輸出請求日誌
if (process.env.NODE_ENV === "development") {
  api.interceptors.request.use((config) => {
    console.log("[API Request]", config.method?.toUpperCase(), config.url);
    return config;
  });
}

export default api;
```

## 安全注意事項

```
❌ 不要把以下內容放到前端環境變數：
  - 資料庫密碼
  - API 金鑰（有許可權的）
  - 私鑰

✅ 可以放的：
  - API 介面地址
  - 功能開關
  - 公開的第三方服務 ID（如高德地圖 key、統計 ID）
```

前端打包後的 JS 程式碼是可以被任何人檢視的。

## 小結

- Vue CLI 專案：用 `.env.*` 檔案，`VUE_APP_` 字首
- 自定義 Webpack：用 `DefinePlugin` + 多份 config 檔案
- `webpack-merge` 合併配置，避免重複
- 敏感資訊不要放前端環境變數