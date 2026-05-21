---
title: "Webpack 4最適化実践：ビルド時間を50%削減する"
date: 2019-01-17 09:30:01
tags:
  - Webpack
  - エンジニアリング
readingTime: 1
description: "プロジェクトが大きくなると、ビルドの遅さが苛立たしくなる。これはチームのWebpack 4最適化の実践記録で、ビルド時間が3分から90秒に短縮された。"
wordCount: 174
---

プロジェクトが大きくなると、ビルドの遅さが苛立たしくなる。これはチームのWebpack 4最適化の実践記録で、ビルド時間が3分から90秒に短縮された。

## 1. ビルド時間の分析

```bash
# 分析ツールのインストール
npm i -D speed-measure-webpack-plugin webpack-bundle-analyzer
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  plugins: [
    new BundleAnalyzerPlugin(), // バンドルサイズを分析
  ],
});
```

まずボトルネックがどこにあるかを把握してから最適化する。

## 2. マルチプロセスコンパイル

```bash
npm i -D thread-loader
```

```javascript
// 重いローダー（babel-loader）をワーカープロセスに移す
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
          "babel-loader?cacheDirectory=true", // キャッシュを有効化！
        ],
      },
    ],
  },
};
```

## 3. キャッシュ（重要な最適化）

```javascript
// cache-loader：ローダーの結果をキャッシュ
{
  test: /\.js$/,
  use: ['cache-loader', 'thread-loader', 'babel-loader']
}

// またはHardSourceWebpackPluginを使用
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')
plugins: [new HardSourceWebpackPlugin()]

// babel-loaderには組み込みキャッシュがある
{
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,
    cacheCompression: false  // キャッシュを圧縮しない（より速い）
  }
}
```

初回ビルド後、後続のビルドはずっと速くなる（3分 → 90秒に短縮）。

## 4. DllPlugin：サードパーティライブラリの事前コンパイル

```javascript
// webpack.dll.js：vendorの事前コンパイル
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
