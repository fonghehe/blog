---
title: "Webpack の loader と plugin の違い"
date: 2018-04-27 10:45:43
tags:
  - Webpack
readingTime: 1
description: "Webpackの設定で`module.rules`（loader）と`plugins`は最も重要な2つの設定項目ですが、違いを混同している人が多いです。"
---

Webpackの設定で`module.rules`（loader）と`plugins`は最も重要な2つの設定項目ですが、違いを混同している人が多いです。

## 核心的な違い

```
Loader：ファイル変換器
  - 個々のファイルに作用する
  - AタイプのファイルをWebpackが理解できるJSモジュールに変換する
  - import/require時にトリガーされる

Plugin：ビルドプロセスの拡張
  - ビルド全体のフローに作用する
  - Webpackのライフサイクルイベントを監視し、適切なタイミングで追加処理を行う
  - 機能は強力だが、設定も複雑
```

## Loader：ファイル変換

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: "vue-loader", // .vueファイル → JSモジュール
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader", // TypeScript → JS
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader", // 3. CSSをDOMに注入
          "css-loader", // 2. @importとurl()を処理
          "sass-loader", // 1. SCSS → CSS（右から左に実行）
        ],
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 8192, // 8KB未満はbase64に変換
          },
        },
      },
    ],
  },
};
```

Loaderの実行順序は**右から左、下から上**：

```javascript
use: ["style-loader", "css-loader", "sass-loader"];
// 実行順序：sass-loader → css-loader → style-loader
```

## Plugin：ビルドの強化

```javascript
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const webpack = require("webpack");

module.exports = {
  plugins: [
    // HTMLを自動生成し、scriptタグを注入
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "index.html",
    }),

    // CSSを独立ファイルに抽出（<style>への注入ではなく）
    new MiniCssExtractPlugin({
      filename: "css/[name].[contenthash:8].css",
    }),

    // バンドルサイズを分析（必要な時だけ有効化）
    process.env.ANALYZE && new BundleAnalyzerPlugin(),

    // グローバル定数を定義
    new webpack.DefinePlugin({
      "process.env.API_URL": JSON.stringify(process.env.API_URL),
    }),
  ].filter(Boolean),
};
```

## 簡単なLoaderを自作する

```javascript
// my-loader.js
module.exports = function (source) {
  // source：ファイルの元の内容（文字列）
  // 戻り値：変換後の内容

  // 例：ファイル内のすべてのconsole.logを削除
  return source.replace(/console\.log\(.*?\);?\n?/g, "");
};
```

## 簡単なPluginを自作する

```javascript
class BuildTimePlugin {
  apply(compiler) {
    // done（ビルド完了）イベントを監視
    compiler.hooks.done.tap("BuildTimePlugin", (stats) => {
      const time = stats.endTime - stats.startTime;
      console.log(`\nビルド時間：${time}ms\n`);
    });
  }
}

module.exports = BuildTimePlugin;
```

## まとめ

|              | Loader             | Plugin                               |
| ------------ | ------------------ | ------------------------------------ |
| 作用範囲     | 個々のファイル     | ビルド全体のフロー                   |
| トリガー     | ファイルのimport時 | Webpackのライフサイクルフック        |
| 設定場所     | `module.rules`     | `plugins`配列                        |
| 典型的な用途 | ファイル形式変換   | 圧縮・コード分割・HTML生成・変数注入 |
