---
title: "Webpackパフォーマンスバジェット：bundlesizeでバンドルサイズの上限を守る"
date: 2019-02-28 10:47:02
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "バンドルサイズはフロントエンドパフォーマンスの重要な指標だ。制限のないプロジェクトは静かに膨らんでいく——ライブラリを追加し、また追加し、気づけば100KBオーバー。パフォーマンスバジェットの考え方は財務予算に似ている：バンドルサイズを予算として扱い、超えたら超過だ。"
wordCount: 507
---

バンドルサイズはフロントエンドパフォーマンスの重要な指標だ。制限のないプロジェクトは静かに膨らんでいく——ライブラリを追加し、また追加し、気づけば100KBオーバー。パフォーマンスバジェットの考え方は財務予算に似ている：バンドルサイズを予算として扱い、超えたら超過だ。

## JSサイズがロードパフォーマンスに与える影響

| JSサイズ | 3Gダウンロード時間 | パース時間 |
| -------- | ------------------ | ---------- |
| 100KB    | 約1秒              | 約300ms    |
| 300KB    | 約3秒              | 約900ms    |
| 1MB      | 約10秒             | 約3秒      |

覚えておこう：JSのCPU時間はダウンロードサイズの約3倍に相当する。2GデバイスではJSが1MBあると、インタラクティブになるまで30秒以上かかる可能性がある。

## Webpack組み込みパフォーマンス警告

```javascript
// webpack.config.js
module.exports = {
  performance: {
    maxEntrypointSize: 250 * 1024, // エントリーポイントは250KB以下
    maxAssetSize: 100 * 1024, // 単一アセットは100KB以下
    hints: "error", // 超過するとビルドエラー
  },
};
```

## bundlesize：CIのパフォーマンスバジェット番人

```bash
npm install --save-dev bundlesize
```

```json
// package.json
{
  "bundlesize": [
    { "path": "./dist/main.*.js", "maxSize": "200 kB" },
    { "path": "./dist/vendor.*.js", "maxSize": "150 kB" },
    { "path": "./dist/*.css", "maxSize": "20 kB" }
  ],
  "scripts": {
    "size": "bundlesize"
  }
}
```

```bash
npm run size
# PASS  ./dist/main.abc123.js: 185.2KB < 200KB gzip
# FAIL  ./dist/vendor.abc123.js: 162.5KB > 150KB gzip
```

## CIへの統合（GitHub Actions）

```yaml
{% raw %}
# .github/workflows/ci.yml
- name: バンドルサイズをチェック
  run: npm run build && npm run size
  env:
    BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
{% endraw %}
```

`BUNDLESIZE_GITHUB_TOKEN`を設定すると、bundlesizeはPRに直接バンドルサイズの変化をコメントする。

## 超過原因の分析

```bash
# webpack-bundle-analyzerで視覚的に分析
npx webpack-bundle-analyzer dist/stats.json

# またはsource-map-explorerを使用
npx source-map-explorer dist/main.*.js
```

超過のよくある原因：

1. `moment.js`がすべてのロケールをバンドルしている（`date-fns`や`dayjs`に代替）
2. `lodash`を全量インポートしている（`import _ from 'lodash'`を避ける）
3. サードパーティCSSライブラリがインデックスバンドルに入っている（動的インポートに変更）
4. 画像/フォントがJSバンドルに入っている（個別出力を設定）

## まとめ

パフォーマンスバジェットのコアは指標を確立し、自動化で守ること。`webpack performance hints` + `bundlesize` + CI統合——この3層の防衛線が、バンドルサイズが知らないうちに膨らむのを防ぐ。
