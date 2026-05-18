---
title: "Webpack 4 優化實戰：讓構建快 50%"
date: 2019-01-17 09:30:01
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "項目大了，構建速度慢得讓人抓狂。這是我們團隊 Webpack 4 優化的實戰記錄，構建時間從 3 分鐘降到 90 秒。"
---

項目大了，構建速度慢得讓人抓狂。這是我們團隊 Webpack 4 優化的實戰記錄，構建時間從 3 分鐘降到 90 秒。

## 1. 分析構建耗時

```bash
# 安裝分析工具
npm i -D speed-measure-webpack-plugin webpack-bundle-analyzer
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  plugins: [
    new BundleAnalyzerPlugin(), // 分析包大小
  ],
});
```

先看清楚慢在哪，再優化。

## 2. 多進程編譯

```bash
npm i -D thread-loader
```

```javascript
// 耗時的 loader（babel-loader）放到 worker 進程
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: "thread-loader",
            options: {
              workers: require("os").cpus().length - 1,
              workerParallelJobs: 50,
            },
          },
          "babel-loader?cacheDirectory=true", // 開啓緩存！
        ],
      },
    ],
  },
};
```

## 3. 緩存（關鍵優化）

```javascript
// cache-loader：緩存 loader 結果
{
  test: /\.js$/,
  use: ['cache-loader', 'thread-loader', 'babel-loader']
}

// 或者使用 HardSourceWebpackPlugin
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')
plugins: [new HardSourceWebpackPlugin()]

// babel-loader 自帶緩存
{
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,
    cacheCompression: false  // 不壓縮緩存，更快
  }
}
```

第一次構建後，後續構建快很多（我們從 3min → 90s）。

## 4. DllPlugin：預編譯第三方庫

```javascript
// webpack.dll.js：預編譯 vendor
const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: {
    vendor: ["vue", "vue-router", "vuex", "axios", "element-ui"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_dll",
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_dll",
      path: path.join(__dirname, "dll/[name].manifest.json"),
    }),
  ],
};
```

```json
// package.json
{
  "scripts": {
    "dll": "webpack --config webpack.dll.js",
    "build": "webpack"
  }
}
```

```javascript
// webpack.config.js：使用預編譯的 dll
new webpack.DllReferencePlugin({
  manifest: require("./dll/vendor.manifest.json"),
});
```

先 `npm run dll`（幾乎不用重跑），後續 build 直接跳過這些庫的編譯。

## 5. 縮小 Loader 處理範圍

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        // 不處理 node_modules（已經是 ES5）
        exclude: /node_modules/,
        // 或精確指定處理範圍
        include: path.resolve(__dirname, "src"),
        use: "babel-loader",
      },
    ],
  },
  resolve: {
    // 減少查找：只找這些擴展名，順序是優先級
    extensions: [".js", ".vue", ".json"],
    // alias 加速解析
    alias: {
      "@": path.resolve(__dirname, "src"),
      vue$: "vue/dist/vue.runtime.esm.js", // 用 runtime-only 版本（更小）
    },
    // 不去 node_modules 找依賴
    modules: [path.resolve(__dirname, "src"), "node_modules"],
  },
};
```

## 6. 生產構建特有優化

```javascript
// production 模式下 Webpack 4 自動開啓：
// - Tree Shaking
// - Scope Hoisting（ModuleConcatenationPlugin）
// - TerserPlugin（壓縮 JS）

module.exports = {
  mode: "production",
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
    // 只在文件內容改變時更新 hash（長期緩存）
    moduleIds: "hashed",
    runtimeChunk: "single",
  },
};
```

## 效果對比

| 場景               | 優化前   | 優化後   |
| 
------------------ | -------- | -------- |
| 首次構建           | 3min 20s | 2min 10s |
| 二次構建（有緩存） | 3min 10s | 1min 30s |
| 增量構建（dev）    | 8s       | 2s       |

## 小結

1. **先分析**：用 SpeedMeasurePlugin 找瓶頸
2. **緩存**：babel-loader + cache-loader，收益最大
3. **多進程**：thread-loader 處理耗時 loader
4. **DllPlugin**：預編譯第三方庫（Webpack 5 用 ModuleFederationPlugin 替代）
5. **精確範圍**：exclude/include 減少不必要的處理
