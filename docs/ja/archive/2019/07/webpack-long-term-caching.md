---
title: "Webpack DllPlugin でビルドを高速化する"
date: 2019-07-29 14:58:32
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "プロジェクトが大きくなると、Webpack のビルド時間が苦痛なほど遅くなります。コードを少し変えるだけで、安定したベンダーライブラリも全て再バンドルされます。DllPlugin は安定したサードパーティライブラリを「DLL」バンドルとして事前コンパイルし、ビルドをまたいで再利用することでこの問題を解決します。"
---

プロジェクトが大きくなると、Webpack のビルド時間が苦痛なほど遅くなります。コードを少し変えるだけで、安定したベンダーライブラリも全て再バンドルされます。DllPlugin は安定したサードパーティライブラリを「DLL」バンドルとして事前コンパイルし、ビルドをまたいで再利用することでこの問題を解決します。

## DllPlugin の仕組み

DllPlugin は2ステップで機能します：

1. **事前コンパイル** — ベンダーライブラリを DLL バンドル + マニフェストファイルとしてコンパイル（一度だけ、または依存関係の変更時に実行）
2. **参照** — メインの webpack 設定で DLL マニフェストを参照し、それらのモジュールをスキップ

## ステップ 1：DLL 設定を作成

`webpack.dll.config.js` を作成：

```javascript
const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  entry: {
    vendor: [
      "react",
      "react-dom",
      "react-router-dom",
      "axios",
      "lodash",
      "moment",
    ],
  },
  output: {
    path: path.resolve(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_[fullhash]", // グローバル変数として公開
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_[fullhash]", // output.library と一致させる
      path: path.resolve(__dirname, "dll", "[name].manifest.json"),
    }),
  ],
};
```

## ステップ 2：メイン設定で DLL を参照

```javascript
const webpack = require("webpack");
const AddAssetHtmlPlugin = require("add-asset-html-webpack-plugin");

module.exports = {
  plugins: [
    new webpack.DllReferencePlugin({
      manifest: require("./dll/vendor.manifest.json"),
    }),

    // DLL スクリプトを HTML に自動挿入
    new AddAssetHtmlPlugin({
      filepath: path.resolve(__dirname, "dll/vendor.dll.js"),
      publicPath: "/dll",
      outputPath: "dll",
    }),
  ],
};
```

## npm スクリプト

```json
{
  "scripts": {
    "dll": "webpack --config webpack.dll.config.js",
    "build": "webpack --config webpack.config.js",
    "build:full": "npm run dll && npm run build"
  }
}
```

依存関係を更新したときだけ `npm run dll` を実行します。通常の開発では `npm run build` だけで十分です。

## まとめ

- DllPlugin は安定したベンダーライブラリを一度だけ事前コンパイルし、その後のビルドで再利用する
- `DllPlugin` がマニフェストを生成し、`DllReferencePlugin` がそれを参照する
- 依存関係が変わったときだけ DLL の再生成が必要
- プロジェクト規模にもよるが、DllPlugin は通常ビルド時間を 60〜80% 削減できる
