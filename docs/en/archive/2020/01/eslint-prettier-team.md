---
title: "ESLint + Prettier: Unifying Team Code Standards"
date: 2020-01-21 17:09:50
tags:
  - Engineering
readingTime: 2
description: "新项目代码风格五花八门，PR review 光讨论格式就浪费大量时间。花了一天把 ESLint + Prettier + Git Hooks 全套配好，团队效率直接提升。"
wordCount: 235
---

新项目代码风格五花八门，PR review 光讨论格式就浪费大量时间。花了一天把 ESLint + Prettier + Git Hooks 全套配好，团队效率直接提升。

## Why Not Just Use ESLint

ESLint 关注代码质量（潜在 bug），Prettier 关注代码格式（风格统一）。两者职责不同：

- ESLint：`no-unused-vars`、`no-undef`、`eqeqeq` 这些是质量问题
- Prettier：缩进、分号、引号、换行这些是格式问题

用 Prettier 管格式，ESLint 管质量，互不干扰。

## Installation and Configuration

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

## Enforcing with Git Hooks

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

加上 `.vscode/extensions.json` 推荐插件：

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "octref.vetur"
  ]
}
```

## Common Pitfalls

```bash
# ESLint 和 Prettier 规则冲突
# 解决：eslint-config-prettier 会关掉所有和 Prettier 冲突的 ESLint 规则
# 确保 extends 里 'plugin:prettier/recommended' 放最后

# 旧项目引入：一步步来
# 1. 先加配置，不自动修复
# 2. 团队成员各自跑一次 fix
# 3. 确认没问题后开启 hooks
```

## Summary

- ESLint 管代码质量，Prettier 管代码格式，各司其职
- `eslint-config-prettier` 解决两者规则冲突
- `husky` + `lint-staged` 在提交时自动修复，保证主分支代码风格一致
- VSCode 配置共享确保每个成员格式化结果一致
- 旧项目渐进式引入，避免一次性改动太多导致冲突
