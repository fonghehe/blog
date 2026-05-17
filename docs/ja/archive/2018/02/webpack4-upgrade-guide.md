---
title: "Webpack 4 正式リリース：ゼロコンフィグ体験とアップグレードガイド"
date: 2018-02-03 11:07:33
tags:
  - Webpack
  - エンジニアリング
readingTime: 3
description: "Webpack 4 が 2 月末に正式リリースされました。最大のポイントは**ゼロコンフィグレーション** — 設定ファイルを書かなくても動かせるということです。いくつかのプロジェクトをアップグレードして、実際の体験をまとめます。"
---

Webpack 4 が 2 月末に正式リリースされました。最大のポイントは**ゼロコンフィグレーション** — 設定ファイルを書かなくても動かせるということです。いくつかのプロジェクトをアップグレードして、実際の体験をまとめます。

## 最も目立つ変更：mode

Webpack 4 では `mode` パラメータが導入され、`development` または `production` を取ります：

```bash
webpack --mode production
webpack --mode development
```

`production` モードで自動的に有効になるもの：

- `TerserPlugin`（コード圧縮）
- `ModuleConcatenationPlugin`（スコープホイスティング）
- `NoEmitOnErrorsPlugin`
- 各種最適化設定

`development` モードで自動的に有効になるもの：

- `NamedChunksPlugin`
- `NamedModulesPlugin`
- より良いエラーメッセージ

以前はこれらをすべて手動で設定する必要がありましたが、今ではほとんどのプロジェクトで `mode` を設定するだけで十分です。

## ビルド速度の向上

公式は 98% 高速化と謳っています（極端なテスト条件下）。実際のプロジェクトでは 30%〜60% の向上が見られます — それでもかなり明確です。

主な理由：

- 永続的なキャッシュ（`cache` オプション）
- モジュール解決アルゴリズムの最適化
- プラグイン内部のオーバーヘッド削減

## アップグレード手順

### 1. 依存関係を更新

```bash
npm uninstall webpack webpack-dev-server
npm install webpack@4 webpack-cli@3 webpack-dev-server@3

# webpack-cli は webpack パッケージから分離されたので、個別にインストールが必要
```

### 2. package.json の scripts を更新

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack-dev-server --mode development --open"
  }
}
```

### 3. 廃止された設定を削除

Webpack 4 はいくつかの古い API を削除しました：

```javascript
// 以前
module.exports = {
  entry: './src/index.js',
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({ ... })  // ❌ 削除済み
    new webpack.optimize.UglifyJsPlugin()             // ❌ 削除済み
  ]
}

// 現在
module.exports = {
  entry: './src/index.js',
  mode: 'production',
  optimization: {
    splitChunks: {           // ✅ CommonsChunkPlugin の代替
      chunks: 'all'
    }
  }
  // UglifyJS は production モードで自動的に有効になる
}
```

### 4. mini-css-extract-plugin に更新

古い `extract-text-webpack-plugin` は Webpack 4 との互換性に問題があります。新しいものに切り替えます：

```bash
npm install mini-css-extract-plugin
```

```javascript
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
  ],
};
```

## splitChunks：CommonsChunkPlugin の新しい代替

これが最大の変更点です。新しい `optimization.splitChunks` はより柔軟です：

```javascript
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // 'async' | 'initial' | 'all'
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: -10,
        },
        common: {
          name: "common",
          minChunks: 2, // 2つ以上のエントリポイントで使われる場合のみ抽出
          chunks: "initial",
          priority: -20,
        },
      },
    },
  },
};
```

## アップグレード時の落とし穴

**問題 1：ローダーが `this.getOptions is not a function` エラーを出す**

原因：一部の古いローダーが Webpack 4 に対応していません。ローダーのバージョンをアップグレードしてください。

**問題 2：`vue-loader` のアップグレードが必要**

```bash
npm install vue-loader@15 vue-template-compiler
```

Vue Loader 15 は `VueLoaderPlugin` が必要です：

```javascript
const { VueLoaderPlugin } = require("vue-loader");

module.exports = {
  plugins: [
    new VueLoaderPlugin(), // 必須、これがないと .vue ファイルが解析されない
  ],
};
```

**問題 3：`webpack-dev-server` の設定オプション名が変更**

```javascript
// Webpack 3
devServer: {
  contentBase: "./dist";
}

// Webpack 4
devServer: {
  static: "./dist"; // contentBase が static に変更（一部バージョン）
}
```

## まとめ

Webpack 4 へのアップグレードには価値があります — ビルド速度とバンドルサイズの両方が改善します。主なコストはプラグイン/ローダーの互換性問題への対処です。大きなプロジェクトを移行する前に、小さなプロジェクトで試すことをお勧めします。
