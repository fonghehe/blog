---
title: "Vue CLI 3 正式版：深度使用指南"
date: 2018-08-11 10:57:54
tags:
  - Vue
readingTime: 1
description: "Vue CLI 3.0 正式版（GA）發佈了，正式從 Beta 階段畢業。比 Beta 版穩定了很多，可以在生產項目使用了。"
---

Vue CLI 3.0 正式版（GA）發佈了，正式從 Beta 階段畢業。比 Beta 版穩定了很多，可以在生產項目使用了。

## 項目結構對比

```
CLI 2 項目結構：
├── build/                  ← webpack 配置文件
│   ├── webpack.base.conf.js
│   ├── webpack.dev.conf.js
│   └── webpack.prod.conf.js
├── config/                 ← 環境變量配置
├── src/
└── package.json

CLI 3 項目結構：
├── src/
├── public/                 ← 不經過 webpack 的靜態資源
├── vue.config.js           ← 可選，所有配置在這一個文件
└── package.json
```

webpack 配置完全內化，項目目錄清爽很多。

## vue.config.js 完整示例

```javascript
const path = require("path");

module.exports = {
  // 部署路徑
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // 輸出目錄
  outputDir: "dist",

  // 靜態資源目錄（相對 outputDir）
  assetsDir: "static",

  // 開發服務器
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

  // CSS 相關
  css: {
    loaderOptions: {
      sass: {
        // 全局注入變量，每個 vue 文件不需要手動 import
        prependData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // 修改 webpack 配置
  chainWebpack: (config) => {
    // 修改 html-webpack-plugin 配置
    config.plugin("html").tap((args) => {
      args[0].title = "我的應用";
      return args;
    });

    // 添加路徑別名
    config.resolve.alias
      .set("@", path.resolve(__dirname, "src"))
      .set("components", path.resolve(__dirname, "src/components"));
  },

  configureWebpack: {
    // 直接合並的 webpack 配置
    performance: {
      hints: process.env.NODE_ENV === "production" ? "warning" : false,
    },
  },
};
```

## 環境變量

```bash
# .env                   # 所有環境
# .env.local             # 本地，不提交 git
# .env.development       # 開發環境
# .env.production        # 生產環境

VUE_APP_API_URL=https://api.example.com
VUE_APP_TITLE=My App
```

代碼中：`process.env.VUE_APP_API_URL`

## 多頁面配置

```javascript
module.exports = {
  pages: {
    index: {
      entry: "src/main.js",
      template: "public/index.html",
      filename: "index.html",
      title: "主頁",
    },
    admin: {
      entry: "src/admin/main.js",
      template: "public/admin.html",
      filename: "admin.html",
      title: "管理後台",
    },
  },
};
```

## 插件開發

CLI 3 的插件系統很強大，自定義插件可以修改 webpack、生成文件、添加命令：

```javascript
// vue-cli-plugin-my-plugin/index.js
module.exports = (api, options) => {
  api.extendPackage({
    dependencies: { lodash: "^4.0.0" },
  });

  api.chainWebpack((config) => {
    // 修改 webpack 配置
  });

  api.registerCommand("my-command", async () => {
    console.log("執行自定義命令");
  });
};
```

## 小結

- CLI 3 GA 版可以放心用於生產
- `vue.config.js` 集中管理所有配置，比維護 webpack 文件簡單
- CSS `prependData` 全局注入變量，省去每個組件手動 import
- 多頁面配置非常簡潔
