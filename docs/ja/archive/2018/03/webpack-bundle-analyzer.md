---
title: "webpack-bundle-analyzer バンドル分析実践"
date: 2018-03-10 16:56:12
tags:
  - Webpack
  - エンジニアリング
readingTime: 3
description: "ビルドが完成して `vendor.js` が 3MB あることに気づいたが、どのライブラリが大きいのかわからない。そんなときの標準ツールが `webpack-bundle-analyzer` です。"
---

ビルドが完成して `vendor.js` が 3MB あることに気づいたが、どのライブラリが大きいのかわからない。そんなときの標準ツールが `webpack-bundle-analyzer` です。

## インストールと設定

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "server", // 分析サーバーを起動。デフォルトポート 8888
      openAnalyzer: true, // 自動的にブラウザを開く
      // analyzerMode: 'static', // 静的 HTML レポートを生成
      // reportFilename: 'report.html'
    }),
  ],
};
```

日常の開発に影響しないよう、必要なときだけ有効化する：

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "analyze": "ANALYZE=true webpack --mode production"
  }
}
```

```javascript
// webpack.config.js
const analyze = process.env.ANALYZE;

module.exports = {
  plugins: [analyze && new BundleAnalyzerPlugin()].filter(Boolean),
};
```

## 分析レポートの読み方

レポートはツリーマップとして表示されます：

- **面積** = ファイルサイズ（gzip 前）
- **色の濃さ** = 含まれるモジュール数
- **クリックで展開** = 含まれる具体的なモジュールを確認

注目すべきポイント：

1. `node_modules` の中で最も大きいライブラリ
2. 重複バンドルされているモジュールがないか
3. 自分のビジネスコードに異常に大きいものがないか

## よくある最適化対象

### 1. lodash が丸ごとバンドルされている

```javascript
// ❌ lodash 全体がバンドルされる（gzip で 71KB）
import _ from "lodash";
const result = _.chunk([1, 2, 3, 4], 2);

// ✅ 必要な関数だけインポート（個別の lodash 関数は数 KB）
import chunk from "lodash/chunk";
const result = chunk([1, 2, 3, 4], 2);

// または lodash-es をインストール（ツリーシェイキング対応）
import { chunk } from "lodash-es";
```

### 2. moment.js のロケールファイル

moment.js はデフォルトで全ロケールファイルをバンドルします（約 160KB）。多くのプロジェクトは数言語しか使いません：

```javascript
// webpack.config.js
const webpack = require("webpack");

module.exports = {
  plugins: [
    // 中国語と英語のみ保持
    new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /zh-cn|en/),
  ],
};
```

または `day.js` に乗り換える（2KB のみ、ほぼ API 互換）。

### 3. Element UI のオンデマンド読み込み

```bash
npm install babel-plugin-component
```

```json
// .babelrc
{
  "plugins": [
    [
      "component",
      {
        "libraryName": "element-ui",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}
```

```javascript
// ❌ 全量インポート（約 500KB）
import ElementUI from "element-ui";
Vue.use(ElementUI);

// ✅ オンデマンドインポート（使用コンポーネントのみバンドル）
import { Button, Table, Form, Input } from "element-ui";
Vue.use(Button);
Vue.use(Table);
```

### 4. ルートの遅延読み込み

```javascript
// ❌ すべてメインバンドルに含まれる
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";

// ✅ オンデマンド読み込み
const HomePage = () => import("@/pages/HomePage");
const AboutPage = () => import("@/pages/AboutPage");

// 関連ルートを一つのチャンクにまとめる
const UserProfile = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserProfile");
const UserSettings = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserSettings");
```

### 5. CDN 外部参照を使う

```javascript
// webpack.config.js
module.exports = {
  externals: {
    vue: "Vue",
    "element-ui": "ELEMENT",
    echarts: "echarts",
  },
};
```

```html
<!-- index.html - CDN から読み込む -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.5.21/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.4.11/lib/index.js"></script>
```

## 実際の最適化記録

| 最適化内容                      | 最適化前  | 最適化後     |
| ------------------------------- | --------- | ------------ |
| lodash 全量 → オンデマンド      | 71KB      | 3KB          |
| moment 全量 → day.js            | 230KB     | 2KB          |
| Element UI オンデマンド読み込み | 500KB     | 200KB        |
| ルート遅延読み込み              | 全量      | オンデマンド |
| **合計サイズ**                  | **1.8MB** | **680KB**    |

gzip 後にさらに約 70% 圧縮されます。最終的に初回画面の JS が 540KB から約 200KB に削減されました。

## まとめ

- まず `webpack-bundle-analyzer` で問題を可視化する
- lodash・moment はよくある肥大化の原因なので個別に対処する
- UI ライブラリのオンデマンド読み込みは効果が大きい
- ルートの遅延読み込みは初回表示体験を大きく改善する
- 闇雲に最適化せず、まず計測してから行動する
