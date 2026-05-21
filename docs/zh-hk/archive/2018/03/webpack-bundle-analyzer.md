---
title: "webpack-bundle-analyzer 打包分析實戰"
date: 2018-03-10 16:56:12
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "項目打包完發現 vendor.js 有 3MB，加載慢，但不知道哪些庫佔了大頭。`webpack-bundle-analyzer` 是這種問題的標準工具。"
wordCount: 377
---

項目打包完發現 vendor.js 有 3MB，加載慢，但不知道哪些庫佔了大頭。`webpack-bundle-analyzer` 是這種問題的標準工具。

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
      analyzerMode: "server", // 啓動分析服務器，默認 8888 端口
      openAnalyzer: true, // 自動打開瀏覽器
      // analyzerMode: 'static', // 生成靜態 HTML 報告
      // reportFilename: 'report.html'
    }),
  ],
};
```

為了不影響日常開發，只在需要分析時啓用：

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

打開報告後，看到一個矩形樹圖：

- **面積大小** = 文件體積（gzip 前）
- **顏色深淺** = 包含的模塊數量
- **可點擊展開** = 查看包含的具體模塊

重點關注：

1. `node_modules` 裏哪些庫最大
2. 有沒有重複打包的模塊
3. 自己寫的業務代碼有沒有異常大的

## 常見優化點

### 1. lodash 整包被打包

```javascript
// ❌ 這會打包整個 lodash（71KB gzip）
import _ from "lodash";
const result = _.chunk([1, 2, 3, 4], 2);

// ✅ 只引入需要的函數（單獨的 lodash 函數包只有幾 KB）
import chunk from "lodash/chunk";
const result = chunk([1, 2, 3, 4], 2);

// 或者安裝 lodash-es（Tree-shaking 友好）
import { chunk } from "lodash-es";
```

### 2. moment.js 的語言包

moment.js 默認會打包所有語言包（約 160KB），實際項目通常只用中文：

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

或者直接換成 `day.js`（只有 2KB，API 基本兼容）。

### 3. Element UI 按需加載

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

// ✅ 按需引入（只打包用到的組件）
import { Button, Table, Form, Input } from "element-ui";
Vue.use(Button);
Vue.use(Table);
```

### 4. 路由懶加載

```javascript
// ❌ 全部打包到主 bundle
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";

// ✅ 按需加載
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
<!-- index.html - 從 CDN 加載 -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.5.21/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.4.11/lib/index.js"></script>
```

## 一次真實優化記錄

| 優化項               | 優化前    | 優化後    |
| 
-------------------- | --------- | --------- |
| 全量 lodash → 按需   | 71KB      | 3KB       |
| 全量 moment → day.js | 230KB     | 2KB       |
| Element UI 按需加載  | 500KB     | 200KB     |
| 路由懶加載           | 首屏全部  | 按需加載  |
| **總體積**           | **1.8MB** | **680KB** |

gzip 之後進一步壓縮約 70%，最終首屏 JS 從 540KB 降到約 200KB。

## 小結

- 先用 `webpack-bundle-analyzer` 可視化找到問題
- lodash/moment 是常見的體積大户，針對性處理
- UI 庫按需加載收益顯著
- 路由懶加載對首屏體驗提升很大
- 不要盲目優化，先測量再行動
