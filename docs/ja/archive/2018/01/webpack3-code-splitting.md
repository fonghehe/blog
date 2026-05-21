---
title: "Webpack 3 コード分割と遅延ローディングの実践"
date: 2018-01-04 17:02:09
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "プロジェクトが大きくなるにつれ、`vendor.js` が 1.8MB に膨れ上がり、初期ロード時間が 8 秒になりました。この記事では、680KB まで削減した診断と最適化のプロセスを説明します。"
wordCount: 474
---

プロジェクトが大きくなるにつれ、`vendor.js` が 1.8MB に膨れ上がり、初期ロード時間が 8 秒になりました。この記事では、680KB まで削減した診断と最適化のプロセスを説明します。

## ステップ 1：webpack-bundle-analyzer で診断

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

`npm run build` を実行するとブラウザにツリーマップが開き、容量を占めているものが分かります。問題の要因：lodash（ライブラリ全体）、moment.js（全ロケール含む）、element-ui（コンポーネントライブラリ全体）。

## ステップ 2：ベンダーライブラリを分割（CommonsChunkPlugin）

```javascript
module.exports = {
  entry: {
    app: "./src/main.js",
    vendor: ["vue", "vue-router", "vuex", "axios", "element-ui"],
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
      minChunks: Infinity,
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: "manifest",
      minChunks: Infinity,
    }),
  ],
};
```

`manifest` チャンクは Webpack のランタイムを格納します。これを抽出しないと、ファイルを変更するたびに `vendor.js` のハッシュが変わり、長期キャッシュが無効化されます。

## ステップ 3：ルートへの動的インポート

最大の効果：ルートを遅延ロードして、ユーザーが訪れたページのみダウンロードします。

```javascript
// 以前：全ページがバンドルに含まれる
import UserList from "@/views/UserList";

// 以降：各ルートが独自のチャンクになる
const routes = [
  {
    path: "/users",
    component: () => import(/* webpackChunkName: "user" */ "@/views/UserList"),
  },
  {
    path: "/users/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "@/views/UserDetail"),
  },
  {
    path: "/orders",
    component: () =>
      import(/* webpackChunkName: "order" */ "@/views/OrderList"),
  },
];
```

`/* webpackChunkName: "user" */` マジックコメントで関連ルートを1つのチャンクにグループ化します。

## ステップ 4：コンポーネントの遅延ローディング

初回レンダリング時に不要な重いコンポーネント：

```javascript
export default {
  components: {
    // リッチテキストエディタはユーザーがエディタを開いた時のみロード
    RichEditor: () => import("@/components/RichEditor"),

    // グラフはグラフタブがアクティブな時のみロード
    Charts: () => ({
      component: import("@/components/Charts"),
      loading: { template: "<div>読み込み中...</div>" },
      delay: 200,
    }),
  },
};
```

## ステップ 5：Moment.js の最適化

Moment.js はデフォルトで全ロケールファイルを含みます（200KB+）。`ContextReplacementPlugin` で必要なものだけ含める：

```javascript
plugins: [
  new webpack.ContextReplacementPlugin(
    /moment[/\\]locale$/,
    /zh-cn/, // 中国語ロケールのみ含める
  ),
];
```

または day.js（2KB）に切り替える。

## 結果

| 最適化           | vendor.js サイズ |
| ---------------- | ---------------- |
| 基準             | 1.8MB            |
| CommonsChunk     | 1.5MB            |
| ルート遅延ロード | 800KB            |
| Moment 修正      | 680KB            |

初期ロードが 8 秒から 3.2 秒に改善されました。
