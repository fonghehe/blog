---
title: "Babel 7正式リリース：アップグレードガイドと新機能"
date: 2018-08-02 16:20:40
tags:
  - Babel
  - エンジニアリング
readingTime: 3
description: "Babel 7が8月に正式リリースされました（非常に長いベータ期間を経て）。いくつかのプロジェクトをアップグレードしたので、主な変更点と踏んだ落とし穴をまとめます。"
---

Babel 7が8月に正式リリースされました（非常に長いベータ期間を経て）。いくつかのプロジェクトをアップグレードしたので、主な変更点と踏んだ落とし穴をまとめます。

## 主な変更点

### 1. パッケージ名の変更：`babel-*`から`@babel/*`へ

最大の破壊的変更です：

```bash
# Babel 6
babel-core
babel-preset-env
babel-preset-react
babel-plugin-transform-runtime

# Babel 7
@babel/core
@babel/preset-env
@babel/preset-react
@babel/plugin-transform-runtime
```

### 2. 年版プリセットの廃止

Babel 6には`babel-preset-es2015`、`babel-preset-es2016`などがありましたが、Babel 7では`@babel/preset-env`に統一されます：

```bash
npm uninstall babel-preset-es2015 babel-preset-es2016
npm install @babel/preset-env
```

### 3. 設定ファイルの形式

新しい`babel.config.js`（プロジェクトレベル）をサポート。より柔軟です：

```javascript
// babel.config.js（新しい推奨方式）
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          browsers: ["> 1%", "last 2 versions", "not ie <= 8"],
        },
        useBuiltIns: "usage", // ポリフィルをオンデマンドで読み込む
        corejs: 3, // core-jsのバージョンを指定
      },
    ],
  ],
  plugins: [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-proposal-optional-chaining", // ?.演算子
    "@babel/plugin-proposal-nullish-coalescing-operator", // ??演算子
  ],
};
```

## アップグレード手順

### ステップ1：依存関係の更新

```bash
# 古い依存関係を削除
npm uninstall babel-core babel-preset-env babel-loader
npm uninstall babel-plugin-transform-runtime

# 新しい依存関係をインストール
npm install --save-dev @babel/core @babel/preset-env
npm install --save-dev @babel/plugin-transform-runtime
npm install @babel/runtime  # ランタイム依存（devDependenciesではない）

# babel-loaderを更新（Babel 7対応）
npm install --save-dev babel-loader@8
```

### ステップ2：設定ファイルの更新

```javascript
// .babelrc（またはbabel.config.js）
{
  "presets": [
    ["@babel/preset-env", {
      "targets": { "browsers": ["> 1%", "last 2 versions"] },
      "useBuiltIns": "usage",
      "corejs": 3
    }]
  ]
}
```

### ステップ3：TypeScriptへの対応（あれば）

```bash
npm install --save-dev @babel/preset-typescript
```

```javascript
// babel.config.js
presets: ["@babel/preset-env", "@babel/preset-typescript"];
```

## 新機能：オプショナルチェーンとNullish合体演算子

この2つのプロポーザルはBabel 7のベータ段階から使えます：

```javascript
// オプショナルチェーン（?.）：ネストされたプロパティへのアクセスにnullチェックが不要
// 以前
const city = user && user.address && user.address.city;

// Babel 7以降
const city = user?.address?.city;

// 関数呼び出し
callback?.();
arr?.[0];

// Nullish合体演算子（??）：||と違い、null/undefinedだけを処理（0や''は処理しない）
const count = response.count ?? 0;
// response.count = 0 → 0（??で置換されない）
// response.count = null → 0（??で置換される）

// ||との違い
const name = user.name || "匿名"; // ''も置換される
const name = user.name ?? "匿名"; // null/undefinedのみ置換
```

## useBuiltIns：よりスマートなポリフィル

```javascript
// useBuiltIns: 'usage' — オンデマンドで読み込む
// 手動でimport 'core-js'する必要なし
// Babelがコードで使われている新機能を解析して、対応するポリフィルを自動挿入

// 例：コードでArray.fromを使っている場合
const arr = Array.from(set);
// Babelがファイルの先頭に自動追加：
// import 'core-js/modules/es.array.from'
```

## 踏んだ落とし穴

**落とし穴1：`core-js`のバージョン**

```bash
# babel 7.4+はcore-js 3が必要。明示的にインストールする必要がある
npm install core-js@3
```

```javascript
// 設定でバージョンを指定
["@babel/preset-env", { useBuiltIns: "usage", corejs: 3 }];
```

**落とし穴2：`babel-upgrade`ツール**

公式のアップグレードツールで依存関係名の変更を自動処理できます：

```bash
npx babel-upgrade --write
```

ただしすべての設定変更が自動処理されるわけではないので、実行後に手動確認が必要です。

**落とし穴3：webpackの`babel-loader`バージョン**

babel-loader 7はBabel 7と互換性がありません。babel-loader 8にアップグレードする必要があります：

```bash
npm install --save-dev babel-loader@8
```

## まとめ

- Babel 7のパッケージ名は`@babel/*`名前空間に全面移行
- `babel.config.js`が新しい推奨設定方式
- `useBuiltIns: 'usage'`でポリフィルをオンデマンドで自動読み込み
- オプショナルチェーン`?.`とNullish合体演算子`??`はとても実用的
- アップグレード前に`babel-upgrade`ツールで依存関係名を自動処理する
