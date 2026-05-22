---
title: "Webpack 4 效能優化：構建速度篇"
date: 2018-05-03 14:57:54
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "隨着項目規模增長，Webpack 構建時間越來越長，每次等待都是效率損耗。這篇文章整理實測有效的構建速度優化手段。"
wordCount: 370
---

隨着項目規模增長，Webpack 構建時間越來越長，每次等待都是效率損耗。這篇文章整理實測有效的構建速度優化手段。

## 測量：先找瓶頸

優化前先知道時間花在哪裏：

```bash
npm install --save-dev speed-measure-webpack-plugin
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  // 你的 webpack 配置
});
```

輸出會顯示每個 loader 和 plugin 的耗時，找出最慢的再優化。

## 優化 1：縮小構建範圍

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "babel-loader",
        include: path.resolve(__dirname, "src"), // 隻處理 src
        exclude: /node_modules/, // 排除 node_modules
      },
    ],
  },
  resolve: {
    // 告訴 webpack 去哪裏找模塊
    modules: [path.resolve(__dirname, "src"), "node_modules"],
    // 減少文件擴展名搜索
    extensions: [".js", ".vue"], // 不加 .json .css，按需添加
    // 模塊別名（避免層級深的相對路徑）
    alias: {
      "@": path.resolve(__dirname, "src"),
      vue$: "vue/dist/vue.esm.js", // 明確指定文件，避免搜索
    },
  },
};
```

## 優化 2：babel-loader 緩存

```javascript
{
  test: /\.js$/,
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true  // 開啓緩存，二次構建快很多
    }
  }
}
```

第一次構建慢，後續構建隻處理變化的檔案。

## 優化 3：多線程構建

```bash
npm install --save-dev thread-loader
```

```javascript
{
  test: /\.js$/,
  use: [
    {
      loader: 'thread-loader',
      options: { workers: 2 }  // 工作線程數，CPU 核數 - 1
    },
    'babel-loader'
  ]
}
```

**注意**：開啓多線程有開銷，隻對計算量大的 loader 才有收益。

## 優化 4：DLL 預編譯

把不常變化的第三方庫（React、Vue、Element UI）預先編譯，開發時直接引用：

```javascript
// webpack.dll.js
const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: {
    vendor: ["vue", "vuex", "vue-router", "axios", "element-ui"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_[hash]",
  },
  plugins: [
    new webpack.DllPlugin({
      path: path.join(__dirname, "dll", "[name]-manifest.json"),
      name: "[name]_[hash]",
    }),
  ],
};
```

```bash
# 先構建 DLL（隻需要運行一次，依賴變化時重跑）
webpack --config webpack.dll.js
```

```javascript
// webpack.config.js 引用 DLL
plugins: [
  new webpack.DllReferencePlugin({
    context: __dirname,
    manifest: require("./dll/vendor-manifest.json"),
  }),
];
```

**實測：** vendor 包含 Vue 全家桶 + Element UI，構建時間從 45s 降到 12s。

## 優化 5：hard-source-webpack-plugin

模塊級別的緩存，比 DLL 更容易配置：

```bash
npm install --save-dev hard-source-webpack-plugin
```

```javascript
const HardSourceWebpackPlugin = require("hard-source-webpack-plugin");

plugins: [new HardSourceWebpackPlugin()];
```

第一次構建時間不變，第二次開始有顯著提升（60%+ 的速度提升）。

## 效果對比

以一箇中型 Vue 項目為例（約 200 個組件）：

| 優化項            | 構建時間   |
| 
----------------- | ---------- |
| 原始              | 48s        |
| babel-loader 緩存 | 32s        |
| + DLL             | 18s        |
| + thread-loader   | 14s        |
| + hard-source     | 8s（二次） |

## 分析是否還有空間

```bash
# 分析打包結果
npm install --save-dev webpack-bundle-analyzer

# 構建後查看
# 是否有意外打進去的大模塊？
# 有沒有重複打包？
```

## 小結

- 先測量，用 `speed-measure-webpack-plugin` 找瓶頸
- `babel-loader` 開緩存是最簡單的優化
- DLL 預編譯對第三方庫效果顯著
- `hard-source-webpack-plugin` 是快速見效的全局緩存方案
- 不要盲目開多線程，線程數過多反而變慢
