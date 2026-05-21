---
title: "Webpack 多环境变量配置"
date: 2018-05-17 15:30:37
tags:
  - Webpack
readingTime: 1
description: "项目里有开发、测试、生产三套环境，API 地址不同、日志级别不同、功能开关也不同。如何优雅地管理这些配置？"
wordCount: 194
---

项目里有开发、测试、生产三套环境，API 地址不同、日志级别不同、功能开关也不同。如何优雅地管理这些配置？

## 方案一：.env 文件（配合 dotenv）

```
.env                # 所有环境共享的基础变量
.env.development    # 开发环境
.env.test           # 测试环境
.env.production     # 生产环境
```

```bash
# .env
APP_NAME=我的应用

# .env.development
API_BASE_URL=http://localhost:3000
LOG_LEVEL=debug

# .env.production
API_BASE_URL=https://api.example.com
LOG_LEVEL=error
```

Vue CLI 项目自动读取这些文件，`VUE_APP_` 前缀的变量会注入到代码里：

```bash
# .env.development
VUE_APP_API_URL=http://localhost:3000
```

```javascript
// 在代码里使用
const baseURL = process.env.VUE_APP_API_URL;
```

## 方案二：Webpack DefinePlugin

对于不用 Vue CLI 的项目，用 `DefinePlugin` 注入：

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
webpack.dev.js        # 开发环境配置
webpack.prod.js       # 生产环境配置
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

## 在代码里使用环境变量

```javascript
// api.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  timeout: 10000,
});

// 开发环境输出请求日志
if (process.env.NODE_ENV === "development") {
  api.interceptors.request.use((config) => {
    console.log("[API Request]", config.method?.toUpperCase(), config.url);
    return config;
  });
}

export default api;
```

## 安全注意事项

```
❌ 不要把以下内容放到前端环境变量：
  - 数据库密码
  - API 密钥（有权限的）
  - 私钥

✅ 可以放的：
  - API 接口地址
  - 功能开关
  - 公开的第三方服务 ID（如高德地图 key、统计 ID）
```

前端打包后的 JS 代码是可以被任何人查看的。

## 小结

- Vue CLI 项目：用 `.env.*` 文件，`VUE_APP_` 前缀
- 自定义 Webpack：用 `DefinePlugin` + 多份 config 文件
- `webpack-merge` 合并配置，避免重复
- 敏感信息不要放前端环境变量