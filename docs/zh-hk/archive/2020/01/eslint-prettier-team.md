---
title: "ESLint + Prettier 統一團隊代碼規範：落地路徑與實戰建議"
date: 2020-01-21 17:09:50
tags:
  - 工程化
readingTime: 2
description: "新項目代碼風格五花八門，PR review 光討論格式就浪費大量時間。花了一天把 ESLint + Prettier + Git Hooks 全套配好，團隊效率直接提升。"
wordCount: 244
---

新項目代碼風格五花八門，PR review 光討論格式就浪費大量時間。花了一天把 ESLint + Prettier + Git Hooks 全套配好，團隊效率直接提升。

## 為什麼不是隻用 ESLint

ESLint 關注代碼質量（潛在 bug），Prettier 關注代碼格式（風格統一）。兩者職責不同：

- ESLint：`no-unused-vars`、`no-undef`、`eqeqeq` 這些是質量問題
- Prettier：縮進、分號、引號、換行這些是格式問題

用 Prettier 管格式，ESLint 管質量，互不幹擾。

## 安裝設定

```bash
# 核心依賴
npm install -D eslint prettier
npm install -D eslint-config-prettier eslint-plugin-prettier

# Vue 項目額外需要
npm install -D eslint-plugin-vue @vue/eslint-config-typescript

# TypeScript 項目
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
    'plugin:prettier/recommended', // 必須放最後
  ],
  rules: {
    // 代碼質量
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',

    // Vue 規範
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

## Git Hooks 強製執行

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

## VSCode 設定共享

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

加上 `.vscode/extensions.json` 推薦插件：

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "octref.vetur"
  ]
}
```

## 踩坑記錄

```bash
# ESLint 和 Prettier 規則衝突
# 解決：eslint-config-prettier 會關掉所有和 Prettier 衝突的 ESLint 規則
# 確保 extends 裏 'plugin:prettier/recommended' 放最後

# 舊項目引入：一步步來
# 1. 先加設定，不自動修復
# 2. 團隊成員各自跑一次 fix
# 3. 確認沒問題後開啓 hooks
```

## 小結

- ESLint 管代碼質量，Prettier 管代碼格式，各司其職
- `eslint-config-prettier` 解決兩者規則衝突
- `husky` + `lint-staged` 在提交時自動修復，保證主分支代碼風格一致
- VSCode 配置共享確保每個成員格式化結果一致
- 舊項目漸進式引入，避免一次性改動太多導致衝突
