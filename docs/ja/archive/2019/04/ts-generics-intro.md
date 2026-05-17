---
title: "TypeScript ジェネリクス入門と実践"
date: 2019-04-18 10:16:18
tags:
  - TypeScript
readingTime: 1
description: "TypeScriptジェネリクスに関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。"
---

TypeScriptジェネリクスに関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。

## クイックスタート

実際の例を見てみましょう：

```javascript
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash:8].js",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: "babel-loader",
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
        },
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({ template: "./src/index.html" }),
    new MiniCssExtractPlugin({ filename: "[name].css" }),
  ],
};
```

このパターンをチームに展開した後、効果は非常に良く、メンテナンスコストが明らかに下がりました。

## 高度な使い方

以下の方法で実装できます：

```javascript
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sumの計算が正しい', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounceが実行を遅延させる', () => {
    jest.useFakeTimers()
    const fn = jest.fn()
    const debounced = debounce(fn, 300)

    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()
```

ジェネリクスを使うことで再利用可能な型安全なコードを書けます。核心的な考え方は**型もパラメータである**ということです——関数が値のパラメータを受け取るように、ジェネリック関数やインターフェースは型パラメータを受け取ります。
