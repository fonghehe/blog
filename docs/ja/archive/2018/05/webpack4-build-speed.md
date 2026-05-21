---
title: "Webpack 4 パフォーマンス最適化：ビルド速度編"
date: 2018-05-03 14:57:54
tags:
  - Webpack
  - エンジニアリング
readingTime: 3
description: "プロジェクトが大きくなるにつれて Webpack のビルド時間が長くなり、待ち時間が効率を下げます。この記事では実測で効果が確認できたビルド速度最適化手法をまとめます。"
wordCount: 635
---

プロジェクトが大きくなるにつれて Webpack のビルド時間が長くなり、待ち時間が効率を下げます。この記事では実測で効果が確認できたビルド速度最適化手法をまとめます。

## 計測：まずボトルネックを見つける

最適化前に時間がどこに使われているか確認します：

```bash
npm install --save-dev speed-measure-webpack-plugin
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  // webpack の設定
});
```

出力には各 loader と plugin の処理時間が表示されます。最も遅いものを見つけてから最適化します。

## 最適化 1：ビルド対象の絞り込み

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "babel-loader",
        include: path.resolve(__dirname, "src"), // src のみ処理
        exclude: /node_modules/, // node_modules を除外
      },
    ],
  },
  resolve: {
    // webpack がモジュールを探す場所
    modules: [path.resolve(__dirname, "src"), "node_modules"],
    // ファイル拡張子の検索を減らす
    extensions: [".js", ".vue"], // .json .css は必要に応じて追加
    // モジュールのエイリアス（深い相対パスを避ける）
    alias: {
      "@": path.resolve(__dirname, "src"),
      vue$: "vue/dist/vue.esm.js", // ファイルを明示して検索を避ける
    },
  },
};
```

## 最適化 2：babel-loader のキャッシュ

```javascript
{
  test: /\.js$/,
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true  // キャッシュを有効化、2回目以降が大幅に速くなる
    }
  }
}
```

最初のビルドは遅いですが、以降は変更されたファイルのみ処理します。

## 最適化 3：マルチスレッドビルド

```bash
npm install --save-dev thread-loader
```

```javascript
{
  test: /\.js$/,
  use: [
    {
      loader: 'thread-loader',
      options: { workers: 2 }  // ワーカー数、CPU コア数 - 1
    },
    'babel-loader'
  ]
}
```

**注意**：マルチスレッドには起動コストがあり、処理量の大きい loader にのみ効果があります。

## 最適化 4：DLL 事前コンパイル

頻繁に変わらないサードパーティライブラリ（React、Vue、Element UI）を事前コンパイルして、開発時に直接参照します：

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
# DLL をビルド（一度だけ実行、依存関係が変わった時に再実行）
webpack --config webpack.dll.js
```

```javascript
// webpack.config.js で DLL を参照
plugins: [
  new webpack.DllReferencePlugin({
    context: __dirname,
    manifest: require("./dll/vendor-manifest.json"),
  }),
];
```

**実測：** vendor に Vue ファミリー + Element UI を含めた場合、ビルド時間が 45 秒から 12 秒に短縮されました。

## 最適化 5：hard-source-webpack-plugin

モジュールレベルのキャッシュで、DLL より設定が簡単です：

```bash
npm install --save-dev hard-source-webpack-plugin
```

```javascript
const HardSourceWebpackPlugin = require("hard-source-webpack-plugin");

plugins: [new HardSourceWebpackPlugin()];
```

初回ビルド時間は変わりませんが、2回目以降は大幅に改善されます（60%以上の速度向上）。

## 効果の比較

中規模 Vue プロジェクト（約 200 コンポーネント）での例：

| 最適化項目              | ビルド時間    |
| ----------------------- | ------------- |
| 元の状態                | 48 秒         |
| babel-loader キャッシュ | 32 秒         |
| + DLL                   | 18 秒         |
| + thread-loader         | 14 秒         |
| + hard-source           | 8 秒（2回目） |

## まだ改善余地があるか分析する

```bash
# バンドル結果の分析
npm install --save-dev webpack-bundle-analyzer

# ビルド後に確認
# 予期しない大きなモジュールが含まれていないか？
# 重複バンドルはないか？
```

## まとめ

- まず計測する。`speed-measure-webpack-plugin` でボトルネックを見つける
- `babel-loader` のキャッシュ有効化が最も簡単な最適化
- DLL 事前コンパイルはサードパーティライブラリに対して効果的
- `hard-source-webpack-plugin` はすぐに効果が出るグローバルキャッシュ
- むやみにマルチスレッドを有効にしない。スレッド数が多すぎるとかえって遅くなる
