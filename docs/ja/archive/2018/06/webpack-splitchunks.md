---
title: "WebpackのsplitChunksによるコード分割実践"
date: 2018-06-09 16:08:30
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "Webpack 4では以前の`CommonsChunkPlugin`が`splitChunks`に置き換えられ、設定がよりシンプルになりました。実際のプロジェクトでの設定を記録します。"
wordCount: 450
---

Webpack 4では以前の`CommonsChunkPlugin`が`splitChunks`に置き換えられ、設定がよりシンプルになりました。実際のプロジェクトでの設定を記録します。

## なぜコード分割が必要か

分割しない場合、すべてのコードが1つの`main.js`にまとめられます。ユーザーが訪れるたびにファイル全体をダウンロードする必要があり、ほとんどのページを使わなくても同様です。

コード分割後：

- 共通ライブラリ（vue、lodash）を個別にバンドルし、ブラウザのキャッシュを活用
- ルートに対応するページをオンデマンドで読み込み
- 初回画面は必要なコードのみ読み込む

## ルートの遅延読み込み（最もシンプルな分割）

```javascript
// router/index.js
const routes = [
  {
    path: "/dashboard",
    component: () =>
      import(/* webpackChunkName: "dashboard" */ "../views/Dashboard.vue"),
  },
  {
    path: "/users",
    component: () =>
      import(/* webpackChunkName: "users" */ "../views/Users.vue"),
  },
];
```

`/* webpackChunkName: "xxx" */`コメントで分割されたchunkに名前を付けることで、分析が容易になります。

## splitChunksの設定

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // すべてのchunkに適用（非同期・同期を含む）
      cacheGroups: {
        // サードパーティの依存関係を個別にバンドル
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: 10,
          chunks: "all",
        },
        // Element UIを個別にバンドル（容量が大きく変更が少ない）
        elementUI: {
          test: /[\\/]node_modules[\\/]element-ui[\\/]/,
          name: "element-ui",
          priority: 20, // vendorsより優先度が高い
          chunks: "all",
        },
        // 複数のchunkで共有されるコード
        common: {
          minChunks: 2, // 少なくとも2つのchunkから参照される
          name: "common",
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
    // ランタイムコードを個別に抽出
    runtimeChunk: {
      name: "runtime",
    },
  },
};
```

## Vue CLI 3での設定

```javascript
// vue.config.js
module.exports = {
  chainWebpack: (config) => {
    config.optimization.splitChunks({
      chunks: "all",
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          priority: -10,
          chunks: "all",
        },
      },
    });
  },
};
```

## バンドル結果の分析

`webpack-bundle-analyzer`をインストールして分割効果を確認します：

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = {
  plugins: [new BundleAnalyzerPlugin()],
};
```

## HTMLでのpreload/prefetch

Vue CLI 3は遅延読み込みのchunkに対して自動的に`<link rel="prefetch">`タグを生成し、ブラウザがアイドル時に先読みします：

```html
<!-- 自動生成される -->
<link rel="prefetch" href="/js/dashboard.js" />
<link rel="prefetch" href="/js/users.js" />
```

## まとめ

- ルートの遅延読み込みは最もシンプルなコード分割方法、1行のコードで実現
- `splitChunks.cacheGroups`でグループ分けを制御
- サードパーティライブラリを個別にバンドルし、ブラウザのキャッシュを最大活用
- bundle analyzerで分割効果を確認する
