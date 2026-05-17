---
title: "npmスクリプトによるワークフロー自動化"
date: 2018-07-12 17:30:27
tags:
  - TypeScript
readingTime: 1
description: "多くの人はnpmスクリプトを`npm start`と`npm run build`だけに使っていますが、実は多くの自動化ができます。"
---

多くの人はnpmスクリプトを`npm start`と`npm run build`だけに使っていますが、実は多くの自動化ができます。

## 基礎

```json
{
  "scripts": {
    "dev": "webpack-dev-server --mode development",
    "build": "webpack --mode production",
    "lint": "eslint src --ext .js,.vue",
    "test": "jest"
  }
}
```

実行：`npm run dev`（`start`、`test`は`run`を省略できる）

## 直列と並列

```json
{
  "scripts": {
    // 直列：&&は前のコマンドが失敗すると停止
    "build": "npm run lint && npm run compile && npm run minify",

    // 並列：&は同時実行（Unix）、またはnpm-run-allを使用
    "dev": "npm run server & npm run watch",

    // npm-run-all（クロスプラットフォーム）
    "dev": "npm-run-all --parallel server watch",
    "build": "npm-run-all lint compile minify"
  }
}
```

```bash
npm install --save-dev npm-run-all
```

## 引数の渡し方

```bash
# --の後の引数がスクリプトに渡される
npm run build -- --watch
npm run lint -- --fix
```

```json
{
  "scripts": {
    "lint": "eslint src",
    "lint:fix": "npm run lint -- --fix"
  }
}
```

## ライフサイクルフック

npmはpre/postフックを提供します：

```json
{
  "scripts": {
    "prebuild": "npm run clean", // buildの前に自動実行
    "build": "webpack --mode production",
    "postbuild": "npm run zip-dist", // buildの後に自動実行

    "pretest": "npm run lint", // テスト前にlintを実行
    "test": "jest"
  }
}
```

## 便利なスクリプト集

```json
{
  "scripts": {
    // ビルドディレクトリのクリーン
    "clean": "rimraf dist",

    // バンドルサイズの分析
    "analyze": "webpack-bundle-analyzer stats.json",

    // 依存関係の更新チェック
    "deps:check": "ncu",
    "deps:update": "ncu -u && npm install",

    // changelogの生成
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",

    // バージョンリリース
    "release:patch": "npm version patch && npm publish",
    "release:minor": "npm version minor && npm publish",

    // 起動後に自動でブラウザを開く
    "dev": "webpack-dev-server --open",

    // すべてのファイルをフォーマット
    "format": "prettier --write \"src/**/*.{js,vue,css,scss}\"",

    // 全チェック（CI用）
    "ci": "npm run lint && npm run test && npm run build"
  }
}
```

## 環境変数

```json
{
  "scripts": {
    // cross-envでクロスプラットフォームの環境変数設定
    "build:staging": "cross-env NODE_ENV=production VUE_APP_ENV=staging webpack",
    "build:prod": "cross-env NODE_ENV=production VUE_APP_ENV=production webpack"
  }
}
```

```bash
npm install --save-dev cross-env rimraf
```

## スクリプトでNodeを使う

scriptsから直接Nodeスクリプトを実行：

```json
{
  "scripts": {
    "gen-icons": "node scripts/generate-icons.js",
    "update-version": "node -e \"require('./scripts/bump-version')()\"",
    "check-size": "node -e \"const s = require('./dist/main.js').length; console.log('Size:', (s/1024).toFixed(1)+'KB')\""
  }
}
```

## まとめ

- `pre`/`post`フックで自動的な直列実行
- `npm-run-all`で並列・直列タスクをクロスプラットフォームで管理
- `cross-env`でクロスプラットフォームの環境変数設定
- よく使う操作はすべてスクリプトに書いて、チームのワークフローを文書化・標準化する
