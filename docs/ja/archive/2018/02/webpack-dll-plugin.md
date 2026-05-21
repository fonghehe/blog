---
title: "Webpack DllPlugin：開発ビルドを高速化する"
date: 2018-02-21 15:30:47
tags:
  - Webpack
readingTime: 2
description: "プロジェクトが大きくなるにつれて、Webpack のコールドスタートがどんどん遅くなります。DllPlugin の考え方は、ほとんど変わらないサードパーティライブラリを別途ビルドしておき、毎回のビルドで再処理しなくて済むようにするというものです。"
wordCount: 445
---

プロジェクトが大きくなるにつれて、Webpack のコールドスタートがどんどん遅くなります。DllPlugin の考え方は、ほとんど変わらないサードパーティライブラリを別途ビルドしておき、毎回のビルドで再処理しなくて済むようにするというものです。

## なぜ DllPlugin が必要か

```
毎回の webpack ビルドで処理するもの：
  - ビジネスコード（頻繁に変わる）
  - React/Vue/lodash/echarts などサードパーティライブラリ（ほとんど変わらない）

DllPlugin のアプローチ：
  - サードパーティライブラリを一度だけビルド → vendor.js + manifest.json を生成
  - 以降のビルドはビルド済みの vendor.js を参照するだけ
  - サードパーティライブラリの処理をスキップ → ビルド速度が大幅に向上
```

## 設定手順

### Step 1：DLL 設定ファイルを作成

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
    library: "[name]_lib", // 外部に公開するグローバル変数名
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_lib",
      path: path.join(__dirname, "dll", "[name]-manifest.json"),
    }),
  ],
};
```

### Step 2：DLL ファイルを生成

```bash
# package.json にコマンドを追加
"scripts": {
  "dll": "webpack --config webpack.dll.js"
}

# 実行（依存バージョンが変わったときだけ再実行）
npm run dll
```

実行後に生成されるファイル：

- `dll/vendor.dll.js`
- `dll/vendor-manifest.json`

### Step 3：メイン設定で DLL を参照

```javascript
// webpack.config.js
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const AddAssetHtmlPlugin = require("add-asset-html-webpack-plugin");

module.exports = {
  plugins: [
    // DLL にあるモジュールはバンドルしないよう webpack に伝える
    new webpack.DllReferencePlugin({
      manifest: require("./dll/vendor-manifest.json"),
    }),

    new HtmlWebpackPlugin({ template: "index.html" }),

    // DLL ファイルを自動的に HTML に注入
    new AddAssetHtmlPlugin({
      filepath: require.resolve("./dll/vendor.dll.js"),
    }),
  ],
};
```

## 効果比較

私のプロジェクト（Vue、echarts、moment などを含む）：

```
DllPlugin なし：コールドスタート約 18 秒
DllPlugin あり：コールドスタート約 7 秒

約 60% の高速化
```

## 注意事項

```javascript
// 1. DLL 内の依存バージョンをアップグレードしたら npm run dll を再実行する
// 2. dll ディレクトリを .gitignore に追加する — 各自がローカルで生成する
// 3. 本番ビルドには通常 DllPlugin を使わない（CI は常にフルビルドする）

// .gitignore
dll/
```

## 2018 年時点の状況

DllPlugin は当時（2018年）最も効果的なビルド高速化手法の一つでした。しかし、Webpack 4 が `cache` と `parallel` オプションを導入した後、DllPlugin の効果は相対的に小さくなりました。Webpack 4 を使っている場合は、まず `cache-loader` と `thread-loader` を試してみてください。それで十分かもしれません。

## まとめ

- DllPlugin はサードパーティライブラリを別途ビルドし、メインビルドではその処理をスキップする
- 手順：dll 設定を作成 → 一度実行して dll を生成 → メイン設定で manifest を参照
- 適したケース：コールドスタートが遅く、サードパーティライブラリが多いプロジェクト
- Webpack 4 にはよりシンプルなキャッシュソリューションがある — まず DllPlugin が必要か評価する
