---
title: "Vue CLI 3 Beta 初體驗：落地路徑與實戰建議"
date: 2018-06-07 10:24:17
tags:
  - Vue
readingTime: 2
description: "Vue CLI 3 剛出 Beta，和之前的 CLI 2 差別很大，試用了一下記錄一下感受。"
wordCount: 346
---

Vue CLI 3 剛出 Beta，和之前的 CLI 2 差別很大，試用了一下記錄一下感受。

## 最大變化：零設定

CLI 2 需要手動維護 webpack.config.js，檔案又長又難懂。CLI 3 把 webpack 設定完全封裝起來，開箱即用：

```bash
npm install -g @vue/cli
vue create my-app
cd my-app
npm run serve
```

就這樣，完全不需要動 webpack 設定。

## 設定方式：vue.config.js

如果需要自定義，在項目根目錄創建 `vue.config.js`：

```javascript
// vue.config.js
module.exports = {
  // 公共路徑
  publicPath: process.env.NODE_ENV === "production" ? "/my-app/" : "/",

  // 開發服務器代理
  devServer: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },

  // webpack 配置合併
  configureWebpack: {
    plugins: [new MyPlugin()],
  },

  // webpack 鏈式修改
  chainWebpack: (config) => {
    config.plugin("html").tap((args) => {
      args[0].title = "我的應用";
      return args;
    });
  },
};
```

## 外掛系統

CLI 3 的一大亮點是插件化。添加功能不再是手動改配置，而是安裝插件：

```bash
vue add router      # 添加 Vue Router
vue add vuex        # 添加 Vuex
vue add element-ui  # 添加 Element UI
vue add pwa         # 添加 PWA 支持
vue add typescript  # 添加 TypeScript
```

外掛會自動修改項目結構和設定，不需要手動改。

## 環境變量

```bash
# .env.production
VUE_APP_API_URL=https://api.example.com
VUE_APP_VERSION=1.0.0
```

在代碼裏用 `process.env.VUE_APP_*` 訪問（隻有 `VUE_APP_` 前綴的才會暴露給客户端）。

## GUI 界面

CLI 3 還有一個 Web 界面（!）：

```bash
vue ui
```

打開瀏覽器，可以在界面裏管理插件、運行腳本、查看構建分析。對不熟悉命令行的人很友好。

## 和 CLI 2 的遷移

舊項目如果想用 CLI 3，暫時沒有自動遷移工具，建議新項目用 CLI 3。舊項目可以繼續用 CLI 2 維護，等時機成熟再遷移。

## 小結

- 零設定，webpack 完全封裝，不需要手動維護
- `vue.config.js` 提供靈活的配置入口
- `vue add` 插件命令一鍵集成功能
- GUI 界面是亮點，降低了入門門檻
