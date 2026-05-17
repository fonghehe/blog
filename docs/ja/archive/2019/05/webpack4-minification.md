---
title: "Webpack 4のコード圧縮と最適化"
date: 2019-05-31 10:33:02
tags:
  - Webpack
  - エンジニアリング
readingTime: 1
description: "Webpack 4のコード圧縮と最適化に関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。"
---

Webpack 4のコード圧縮と最適化に関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。

## TerserによるJavaScript圧縮

Webpack 4のプロダクションモードはデフォルトでTerserPluginを使用します：

```javascript
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: "production",
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // console.logを削除
            drop_debugger: true, // debugger文を削除
            pure_funcs: ["console.log"],
          },
          mangle: true, // 変数名を難読化
          output: {
            comments: false, // コメントを削除
          },
        },
        extractComments: false, // コメントを別ファイルに抽出しない
      }),
    ],
  },
};
```

## CSS圧縮

```javascript
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [new MiniCssExtractPlugin({ filename: "[name].[contenthash].css" })],
  optimization: {
    minimizer: [new CssMinimizerPlugin()],
  },
};
```

## バンドル分析

```bash
# アナライザーをインストール
npm install --save-dev webpack-bundle-analyzer

# 統計ファイルを生成
webpack --profile --json > stats.json

# 可視化
npx webpack-bundle-analyzer stats.json
```

```javascript
// またはプラグインを直接使用
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = {
  plugins: [process.env.ANALYZE && new BundleAnalyzerPlugin()].filter(Boolean),
};
```

`ANALYZE=true npm run build`を実行するとバンドルのビジュアルツリーマップが開きます——最適化の機会を見つけるための最初のステップです。
