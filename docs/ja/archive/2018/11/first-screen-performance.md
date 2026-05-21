---
title: "フロントエンド初期表示パフォーマンス最適化の実践"
date: 2018-11-06 16:51:48
tags:
  - パフォーマンス最適化
readingTime: 2
description: "初期表示の読み込み速度はユーザー体験に直接影響します。社内プロジェクトを一度最適化し、有効な手段を記録します。"
wordCount: 461
---

初期表示の読み込み速度はユーザー体験に直接影響します。社内プロジェクトを一度最適化し、有効な手段を記録します。

## 問題の診断

最適化前に Lighthouse でスコアを確認してボトルネックを見つけます：

```bash
lighthouse https://yourdomain.com --output html --output-path ./report.html
```

プロジェクトの主な問題：FCP 4.2s（< 1.8s であるべき）、主な原因：

- JS バンドルが大きすぎる：main.js 2.4MB
- ルートの遅延読み込みなし
- すべての依存関係が同期ロード

## 最適化 1：ルートの遅延読み込み（最大の効果）

```javascript
// 以前：同期 import で main.js にバンドル
import Dashboard from "./views/Dashboard.vue";
import Users from "./views/Users.vue";

// 以後：動的 import でオンデマンド読み込み
const routes = [
  { path: "/dashboard", component: () => import("./views/Dashboard.vue") },
  { path: "/users", component: () => import("./views/Users.vue") },
];
```

効果：main.js が 2.4MB から 380KB に削減、FCP が最大改善。

## 最適化 2：gzip/Brotli 圧縮

```bash
# nginx.conf
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/javascript application/json;
gzip_min_length 1024;

# brotli（gzip より圧縮率が高い、nginx brotli モジュールが必要）
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/javascript;
```

ビルド時に圧縮ファイルを事前生成することもできます：

```javascript
// webpack：compression-webpack-plugin
const CompressionPlugin = require("compression-webpack-plugin");

plugins: [
  new CompressionPlugin({
    algorithm: "gzip",
    test: /\.(js|css|html)$/,
    threshold: 10240, // 10KB 以上のみ圧縮
    minRatio: 0.8,
  }),
];
```

## 最適化 3：サードパーティライブラリの CDN 配信

```javascript
// vue.config.js：大きな依存関係を webpack の外に出す
module.exports = {
  configureWebpack: {
    externals: {
      vue: "Vue",
      "element-ui": "ELEMENT",
      echarts: "echarts",
    },
  },
};
```

```html
<!-- CDN から読み込み、キャッシュを活用 -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.6.10/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.12.0/lib/index.js"></script>
```

## 最適化 4：重要なリソースの preload

```html
<!-- 重要なフォント/スクリプトを早期に読み込むようブラウザに指示 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin />
<link rel="preload" href="/js/chunk-vendors.js" as="script" />

<!-- prefetch：次のページで使う可能性のあるリソースを事前に読み込む -->
<link rel="prefetch" href="/js/dashboard.js" />
```

Vue CLI 3 は遅延読み込みチャンクに対して自動的に prefetch タグを生成します。

## 最適化 5：レンダリングブロッキングの削減

```html
<!-- CSS は head に配置し、レンダリングをブロック（必須）-->
<link rel="stylesheet" href="main.css" />

<!-- JS は body の最後に配置するか、defer/async を追加 -->
<script defer src="main.js"></script>
<!-- defer：HTML の解析後に順番に実行 -->
<script async src="analytics.js"></script>
<!-- async：ダウンロード完了後すぐに実行 -->
```

## 最適化結果

| 指標                | 最適化前 | 最適化後               |
| ------------------- | -------- | ---------------------- |
| FCP                 | 4.2s     | 1.6s                   |
| JS パッケージサイズ | 2.4MB    | 380KB（+遅延読み込み） |
| Lighthouse スコア   | 42       | 87                     |

## まとめ

1. ルートの遅延読み込み：最大の効果、必須
2. gzip 圧縮：サーバー設定、一度やれば永続的
3. サードパーティライブラリの CDN：メインバンドルを縮小、キャッシュを活用
4. 重要なリソースの preload：レンダリングブロック時間を削減
5. JS に defer を追加、非重要 CSS を非同期ロード
