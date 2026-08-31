---
title: "ESLint + Prettier でチームのコードスタイルを統一する"
date: 2020-01-21 17:09:50
tags:
  - エンジニアリング
readingTime: 2
description: "新项目代码风格五花八门，PR review 光讨论格式就浪费大量时间。花了一天把 ESLint + Prettier + Git Hooks 全套配好，团队效率直接提升。"
wordCount: 430
---

新規プロジェクトではコードスタイルがまちまちで、PR レビューでフォーマットの議論だけで多くの時間を無駄にしていた。ESLint + Prettier + Git Hooks を一式そろえて設定し、チームの効率は一気に上がった。

## なぜESLintだけではないのか

ESLint はコードの品質（潜在的なバグ）を、Prettier はコードのフォーマット（スタイルの統一）を担当する。両者の役割は異なる。

- ESLint：`no-unused-vars`、`no-undef`、`eqeqeq` といったものは品質の問題だ
- Prettier：インデント、セミコロン、引用符、改行といったものはフォーマットの問題だ

フォーマットは Prettier に、品質は ESLint に任せれば、互いに干渉しない。

## インストールと設定

```bash
# 核心依赖
npm install -D eslint prettier
npm install -D eslint-config-prettier eslint-plugin-prettier

# Vue 项目额外需要
npm install -D eslint-plugin-vue @vue/eslint-config-typescript

# TypeScript 项目
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

## .eslintrc.js

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2020: true,
  },
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/recommended',
    '@vue/typescript/recommended',
    'plugin:prettier/recommended', // 必须放最后
  ],
  rules: {
    // 代码质量
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',

    // Vue 规范
    'vue/component-name-in-template-casing': ['error', 'kebab-case'],
    'vue/no-v-html': 'warn',
    'vue/require-default-prop': 'error',
  },
};
```

## .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "vueIndentScriptAndStyle": false
}
```

## Git Hooksによる強制実行

```bash
npm install -D husky lint-staged
```

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,ts,vue}": [
      "eslint --fix",
      "git add"
    ],
    "*.{json,md,yml,css,scss}": [
      "prettier --write",
      "git add"
    ]
  }
}
```

## VSCode 配置共享

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "vue"
  ],
  "files.eol": "\n"
}
```

さらに `.vscode/extensions.json` でプラグインを推奨設定に追加する：

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "octref.vetur"
  ]
}
```

## ハマりやすい注意点

```bash
# ESLint 和 Prettier 规则冲突
# 解决：eslint-config-prettier 会关掉所有和 Prettier 冲突的 ESLint 规则
# 确保 extends 里 'plugin:prettier/recommended' 放最后

# 旧项目引入：一步步来
# 1. 先加配置，不自动修复
# 2. 团队成员各自跑一次 fix
# 3. 确认没问题后开启 hooks
```

## まとめ

- ESLint はコードの品質を、Prettier はコードのフォーマットを担当し、役割を分担する
- `eslint-config-prettier` が両者のルールの衝突を解決する
- `husky` + `lint-staged` がコミット時に自動修正し、main ブランチのコードスタイルの統一を保証する
- VSCode の設定共有により、全メンバーのフォーマット結果を一致させる
- 既存プロジェクトには段階的に導入し、一度に多くを変更して衝突するのを避ける
