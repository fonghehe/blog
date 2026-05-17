---
title: "ESLint + Prettier エンジニアリング標準の実践"
date: 2018-01-30 11:21:56
tags:
  - エンジニアリング
readingTime: 2
description: "ESLint と Prettier はよく一緒に使われますが、それぞれ異なる役割があります。多くのチュートリアルでは混同されています。役割分担を明確にしましょう。"
---

ESLint と Prettier はよく一緒に使われますが、それぞれ異なる役割があります。多くのチュートリアルでは混同されています。役割分担を明確にしましょう。

## 役割分担

- **ESLint**：コード品質チェック（未使用変数、到達不能コード、潜在的なエラー）
- **Prettier**：コードフォーマット（インデント、クォート、セミコロン、行の長さ）

競合が発生した場合、フォーマットの決定は完全に Prettier に委ねます。ESLint でフォーマットスタイルを強制しないようにしましょう。

## インストールと設定

```bash
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier
# Vue プロジェクトの場合は追加：
npm install --save-dev eslint-plugin-vue
```

```javascript
// .eslintrc.js
module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:vue/essential",
    "prettier", // ESLint のフォーマットルールを無効化（最後に配置）
  ],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": "error", // Prettier 違反 = ESLint エラー
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
  },
};
```

```javascript
// .prettierrc.js
module.exports = {
  semi: false, // セミコロンなし
  singleQuote: true, // シングルクォート
  printWidth: 100, // 最大行長
  trailingComma: "es5", // ES5 で有効な場所に末尾カンマ
  tabWidth: 2, // 2スペースインデント
  endOfLine: "lf", // LF 改行（クロスプラットフォームチームに重要）
};
```

## npm スクリプト

```json
{
  "scripts": {
    "lint": "eslint --ext .js,.vue src",
    "lint:fix": "eslint --ext .js,.vue src --fix",
    "format": "prettier --write src/**/*.{js,vue,css,scss}"
  }
}
```

## Git フック：自動強制

```bash
npm install --save-dev husky lint-staged
```

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "src/**/*.{js,vue}": ["eslint --fix", "git add"],
    "src/**/*.{css,scss,json,md}": ["prettier --write", "git add"]
  }
}
```

この設定により、コミット前に lint-staged がステージングされたファイルのリントとフォーマットの問題を自動修正します。

## VS Code との統合

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 既存プロジェクトへの段階的な導入

フォーマットが統一されていない大規模コードベースには：

1. `prettier --write` を一度実行してすべてを統一的にフォーマット — 別の PR で行う
2. `lint-staged` を有効にして、今後は変更されたファイルのみチェック
3. チームが慣れるにつれて、ESLint ルールを段階的に厳しくする
