---
title: "Webpack DllPlugin 加速開發構建"
date: 2018-02-21 15:30:47
tags:
  - Webpack
readingTime: 1
description: "專案越來越大，Webpack 冷啟動越來越慢。DllPlugin 的思路是：把不經常變動的第三方庫單獨打包，之後每次構建就不用重新處理它們了。"
---

專案越來越大，Webpack 冷啟動越來越慢。DllPlugin 的思路是：把不經常變動的第三方庫單獨打包，之後每次構建就不用重新處理它們了。

## 為什麼需要 DllPlugin

```
每次 webpack 構建，都要處理：
  - 業務程式碼（經常變）
  - React/Vue/lodash/echarts 等第三方庫（幾乎不變）

DllPlugin 方案：
  - 把第三方庫單獨打包一次 → 生成 vendor.js + manifest.json
  - 之後每次構建，直接引用打好的 vendor.js
  - 跳過第三方庫的處理，構建速度大幅提升
```

## 配置步驟

### Step 1：建立 dll 配置檔案

```javascript
// webpack.dll.js
const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: {
    vendor: ["vue", "vue-router", "vuex", "axios", "lodash"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_lib", // 暴露給外部的變數名
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_lib",
      path: path.join(__dirname, "dll", "[name]-manifest.json"),
    }),
  ],
};
```

### Step 2：生成 dll 檔案

```bash
# package.json 里加個命令
"scripts": {
  "dll": "webpack --config webpack.dll.js"
}

# 執行（依賴版本有變動時才需要重新跑）
npm run dll
```

執行後生成：

- `dll/vendor.dll.js`
- `dll/vendor-manifest.json`

### Step 3：在主配置裡引用

```javascript
// webpack.config.js
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const AddAssetHtmlPlugin = require("add-asset-html-webpack-plugin");

module.exports = {
  plugins: [
    // 告訴 webpack 哪些模組不需要打包，去 dll 裡找
    new webpack.DllReferencePlugin({
      manifest: require("./dll/vendor-manifest.json"),
    }),

    new HtmlWebpackPlugin({ template: "index.html" }),

    // 自動把 dll 檔案注入 HTML
    new AddAssetHtmlPlugin({
      filepath: require.resolve("./dll/vendor.dll.js"),
    }),
  ],
};
```

## 效果對比

在我的專案（引入了 Vue、echarts、moment 等）：

```
不用 DllPlugin：冷啟動 ~18s
用了 DllPlugin：冷啟動 ~7s

提升約 60%
```

## 注意事項

```javascript
// 1. dll 裡的依賴版本升級後，要重新執行 npm run dll
// 2. dll 檔案要加進 .gitignore，每個人本地生成
// 3. 生產構建一般不用 DllPlugin（CI 每次都是全量構建）

// .gitignore
dll/
```

## 2018 年現狀

DllPlugin 是當時（2018年）加速構建最有效的方案之一。不過 Webpack 4 的 cache 和 parallel 選項出來之後，DllPlugin 的收益相對降低了。如果你在用 Webpack 4，先試試 `cache-loader` 和 `thread-loader`，可能就夠了。

## 小結

- DllPlugin：把第三方庫單獨打包，主構建跳過處理它們
- 步驟：建立 dll config → 執行一次生成 dll → 主 config 引用 manifest
- 適合：冷啟動慢、第三方庫多的專案
- Webpack 4 有更簡單的快取方案，可以先評估再用 DllPlugin