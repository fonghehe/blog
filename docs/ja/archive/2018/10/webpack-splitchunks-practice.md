---
title: "Webpack 共通コード抽出と SplitChunks"
date: 2018-10-25 10:34:15
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "プロジェクトのページが増えるにつれて、複数のページで使われているコードが重複してバンドルされます。`SplitChunks` を使えば共通コードを抽出して、ブラウザのキャッシュで再利用できます。"
---

プロジェクトのページが増えるにつれて、複数のページで使われているコードが重複してバンドルされます。`SplitChunks` を使えば共通コードを抽出して、ブラウザのキャッシュで再利用できます。

## なぜコード分割が必要か

```
プロジェクトに A、B、C の3つのページがあり、すべて lodash と Vue を使用
分割なしの場合：
  pageA.js = pageA のコード + lodash + Vue
  pageB.js = pageB のコード + lodash + Vue
  pageC.js = pageC のコード + lodash + Vue
  → lodash と Vue が3回ダウンロードされる！

分割後：
  vendor.js = lodash + Vue（一度だけダウンロード、長期キャッシュ）
  common.js = A/B/C で共有するビジネスコード
  pageA.js = pageA 自身のコード（非常に小さい）
```

## Webpack 4 の SplitChunks

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // すべてのチャンクに適用（async/initial/all）

      cacheGroups: {
        // サードパーティライブラリを別個にバンドル
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 20,
        },

        // 共通ビジネスコード
        common: {
          name: "common",
          minChunks: 2, // 少なくとも2つのチャンクから参照される
          chunks: "all",
          priority: 10,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

## より細かい分割

```javascript
cacheGroups: {
  // Vue フレームワークを別個にバンドル（ほとんど変わらない — 長期キャッシュ）
  vue: {
    test: /[\\/]node_modules[\\/](vue|vue-router|vuex)[\\/]/,
    name: 'vue',
    chunks: 'all',
    priority: 30
  },

  // Element UI を別個にバンドル（大きいので個別キャッシュが効果的）
  elementUI: {
    test: /[\\/]node_modules[\\/]element-ui[\\/]/,
    name: 'element-ui',
    chunks: 'all',
    priority: 25
  },

  // その他のサードパーティライブラリ
  vendors: {
    test: /[\\/]node_modules[\\/]/,
    name: 'vendors',
    chunks: 'all',
    priority: 20
  },

  // プロジェクトの共通コード
  common: {
    name: 'common',
    minChunks: 2,
    chunks: 'all',
    priority: 10
  }
}
```

## ランタイムチャンク

```javascript
optimization: {
  // webpack のランタイムコードを別個に抽出
  // ランタイムの変化による vendor ハッシュの変更を防ぐ
  runtimeChunk: {
    name: "runtime";
  }
}
```

## キャッシュ戦略との組み合わせ

```javascript
output: {
  // contenthash：コンテンツが変わらなければハッシュも変わらず、ブラウザが長期キャッシュできる
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js'
}
```

分割戦略：

```
runtime.js    → 非常に小さい、ビルドごとに変わる可能性がある
vendor.js     → サードパーティライブラリ、ほぼ変わらない、長期キャッシュ
common.js     → ビジネス共通コード、時々変わる
pageA.js      → ページコード、頻繁に変わる
```

## Vue CLI のデフォルト設定

Vue CLI はすでに合理的なデフォルト設定を提供しているため、通常は手動で変更する必要はありません：

```javascript
// vue.config.js（デフォルトが要件を満たさない場合にのみ調整）
module.exports = {
  chainWebpack(config) {
    config.optimization.splitChunks({
      cacheGroups: {
        vendors: {
          name: "chunk-vendors",
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: "initial",
        },
      },
    });
  },
};
```

## 効果

私たちのプロジェクトでの分割最適化後：

```
最適化前：
  app.js：1.2MB（初回および以降のすべてのページでダウンロード）

最適化後：
  vendor.js：600KB（初回ダウンロード後、以降のすべてのページでキャッシュ再利用）
  common.js：100KB
  各ページチャンク：30〜80KB

初回の合計サイズはほぼ同じだが、以降のページナビゲーションはページチャンクのダウンロードのみ
```

## まとめ

- `splitChunks.chunks: 'all'` はすべてのコードに適用される
- `cacheGroups` で異なる抽出戦略を定義する
- サードパーティライブラリを変更頻度でグループ化：コアフレームワーク、大型 UI ライブラリ、その他
- `contenthash` でコンテンツが変わらない限りキャッシュが有効になることを保証する
- Vue CLI には合理的なデフォルト値がある — 調整が必要かどうかはバンドルアナライザーを実行してから判断する
