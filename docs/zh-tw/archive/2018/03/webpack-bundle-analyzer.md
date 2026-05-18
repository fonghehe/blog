---
title: "webpack-bundle-analyzer 打包分析實戰"
date: 2018-03-10 16:56:12
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "專案打包完發現 vendor.js 有 3MB，載入慢，但不知道哪些庫佔了大頭。`webpack-bundle-analyzer` 是這種問題的標準工具。"
---

專案打包完發現 vendor.js 有 3MB，載入慢，但不知道哪些庫佔了大頭。`webpack-bundle-analyzer` 是這種問題的標準工具。

## 安裝和配置

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "server", // 啟動分析伺服器，預設 8888 埠
      openAnalyzer: true, // 自動開啟瀏覽器
      // analyzerMode: 'static', // 生成靜態 HTML 報告
      // reportFilename: 'report.html'
    }),
  ],
};
```

為了不影響日常開發，只在需要分析時啟用：

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "analyze": "ANALYZE=true webpack --mode production"
  }
}
```

```javascript
// webpack.config.js
const analyze = process.env.ANALYZE;

module.exports = {
  plugins: [analyze && new BundleAnalyzerPlugin()].filter(Boolean),
};
```

## 讀懂分析報告

開啟報告後，看到一個矩形樹圖：

- **面積大小** = 檔案體積（gzip 前）
- **顏色深淺** = 包含的模組數量
- **可點選展開** = 檢視包含的具體模組

重點關注：

1. `node_modules` 裡哪些庫最大
2. 有沒有重複打包的模組
3. 自己寫的業務程式碼有沒有異常大的

## 常見最佳化點

### 1. lodash 整包被打包

```javascript
// ❌ 這會打包整個 lodash（71KB gzip）
import _ from "lodash";
const result = _.chunk([1, 2, 3, 4], 2);

// ✅ 只引入需要的函式（單獨的 lodash 函式包只有幾 KB）
import chunk from "lodash/chunk";
const result = chunk([1, 2, 3, 4], 2);

// 或者安裝 lodash-es（Tree-shaking 友好）
import { chunk } from "lodash-es";
```

### 2. moment.js 的語言包

moment.js 預設會打包所有語言包（約 160KB），實際專案通常只用中文：

```javascript
// webpack.config.js
const webpack = require("webpack");

module.exports = {
  plugins: [
    // 只保留中文和英文
    new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /zh-cn|en/),
  ],
};
```

或者直接換成 `day.js`（只有 2KB，API 基本相容）。

### 3. Element UI 按需載入

```bash
npm install babel-plugin-component
```

```json
// .babelrc
{
  "plugins": [
    [
      "component",
      {
        "libraryName": "element-ui",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}
```

```javascript
// ❌ 全量引入（約 500KB）
import ElementUI from "element-ui";
Vue.use(ElementUI);

// ✅ 按需引入（只打包用到的元件）
import { Button, Table, Form, Input } from "element-ui";
Vue.use(Button);
Vue.use(Table);
```

### 4. 路由懶載入

```javascript
// ❌ 全部打包到主 bundle
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";

// ✅ 按需載入
const HomePage = () => import("@/pages/HomePage");
const AboutPage = () => import("@/pages/AboutPage");

// 相關路由合併成一個 chunk
const UserProfile = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserProfile");
const UserSettings = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserSettings");
```

### 5. 使用 CDN 外鏈

```javascript
// webpack.config.js
module.exports = {
  externals: {
    vue: "Vue",
    "element-ui": "ELEMENT",
    echarts: "echarts",
  },
};
```

```html
<!-- index.html - 從 CDN 載入 -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.5.21/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.4.11/lib/index.js"></script>
```

## 一次真實最佳化記錄

| 最佳化項               | 最佳化前    | 最佳化後    |
| 
-------------------- | --------- | --------- |
| 全量 lodash → 按需   | 71KB      | 3KB       |
| 全量 moment → day.js | 230KB     | 2KB       |
| Element UI 按需載入  | 500KB     | 200KB     |
| 路由懶載入           | 首屏全部  | 按需載入  |
| **總體積**           | **1.8MB** | **680KB** |

gzip 之後進一步壓縮約 70%，最終首屏 JS 從 540KB 降到約 200KB。

## 小結

- 先用 `webpack-bundle-analyzer` 視覺化找到問題
- lodash/moment 是常見的體積大戶，針對性處理
- UI 庫按需載入收益顯著
- 路由懶載入對首屏體驗提升很大
- 不要盲目最佳化，先測量再行動
