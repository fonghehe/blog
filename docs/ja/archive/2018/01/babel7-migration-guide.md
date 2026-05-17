---
title: "Babel 7 移行ガイド"
date: 2018-01-27 15:13:59
tags:
  - Babel
  - エンジニアリング
readingTime: 2
description: "Babel 7 ベータが長期間公開されています。バージョン 6 から 7 への移行には破壊的変更がありますが、便利な新機能も追加されました。実際のプロジェクト移行の記録です。"
---

Babel 7 ベータが長期間公開されています。バージョン 6 から 7 への移行には破壊的変更がありますが、便利な新機能も追加されました。実際のプロジェクト移行の記録です。

## Babel 7 の主な変更点

### 1. スコープ付きパッケージ名

全ての公式パッケージが `@babel/` 名前空間に移動しました：

```bash
# Babel 6
babel-core
babel-preset-env

# Babel 7
@babel/core
@babel/preset-env
```

### 2. `@babel/preset-env` の改善

```javascript
// babel.config.js（Babel 7 推奨形式）
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: { browsers: ["> 1%", "last 2 versions"] },
        useBuiltIns: "usage", // 必要な polyfill のみ自動インポート（新機能）
        corejs: 3, // core-js バージョン指定（新機能）
        modules: false, // Tree Shaking のため ES Module を保持
      },
    ],
  ],
};
```

`useBuiltIns: 'usage'` はコードを分析して実際に使用している ES6+ 機能のみの polyfill をインポートします。

### 3. プロジェクトレベルの設定：babel.config.js

Babel 6 の `.babelrc` はそのディレクトリとサブディレクトリにのみ適用され、monorepo プロジェクトでは不便でした。Babel 7 ではプロジェクトルートに `babel.config.js` を導入：

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);

  const presets = [
    [
      "@babel/preset-env",
      {
        targets: { node: "current" },
        modules: "commonjs",
      },
    ],
  ];

  const plugins = [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
  ];

  return { presets, plugins };
};
```

## アップグレード手順

### ステップ 1：依存関係の更新

```bash
# 古いパッケージを削除
npm uninstall babel-core babel-cli babel-preset-env babel-preset-react

# 新しいパッケージをインストール
npm install --save-dev @babel/core @babel/cli @babel/preset-env @babel/preset-react \
  @babel/plugin-proposal-class-properties @babel/plugin-proposal-object-rest-spread

# polyfill 関連
npm install @babel/polyfill core-js@3
```

### ステップ 2：設定ファイルの更新

```javascript
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "usage",
        corejs: 3,
        modules: false,
      },
    ],
    "@babel/preset-react",
  ],
  plugins: [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
  ],
  env: {
    test: {
      presets: [["@babel/preset-env", { targets: { node: "current" } }]],
    },
  },
};
```

### ステップ 3：Webpack との統合を更新

```bash
npm install --save-dev babel-loader  # babel-loader 8.x は Babel 7 対応
```

```javascript
// webpack.config.js
module: {
  rules: [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          cacheDirectory: true,
        },
      },
    },
  ];
}
```

## よくある落とし穴

**落とし穴 1：`@babel/polyfill` は非推奨**

Babel 7.4 から `@babel/polyfill` は非推奨になりました：

```javascript
// 以前
import "@babel/polyfill";

// 以降（または useBuiltIns: 'usage' で自動処理）
import "core-js/stable";
import "regenerator-runtime/runtime";
```

**落とし穴 2：クラスプロパティ構文**

```javascript
class MyComponent extends React.Component {
  state = { count: 0 }; // クラスフィールド (stage-3)
  handleClick = () => {}; // アロー関数プロパティ
}
```

`@babel/plugin-proposal-class-properties` が必要です。`loose` モードの違いに注意してください。
