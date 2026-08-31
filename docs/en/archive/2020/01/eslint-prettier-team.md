---
title: "ESLint + Prettier: Unifying Team Code Standards"
date: 2020-01-21 17:09:50
tags:
  - Engineering
readingTime: 2
description: "In a new project the code style was all over the place, and PR reviews wasted time just debating formatting. Spending a day to set up the full ESLint + Prettier + Git Hooks stack directly boosted the team's efficiency."
wordCount: 179
---

In a new project the code style was all over the place, and PR reviews wasted a lot of time just discussing formatting. Spending a day to set up the full ESLint + Prettier + Git Hooks stack directly improved the team's efficiency.

## Why Not Just Use ESLint

ESLint focuses on code quality (potential bugs), while Prettier focuses on code formatting (style consistency). Their responsibilities differ:

- ESLint: `no-unused-vars`, `no-undef`, `eqeqeq` are quality issues
- Prettier: indentation, semicolons, quotes, line breaks are formatting issues

Let Prettier handle formatting and ESLint handle quality, so they don't step on each other's toes.

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

## Sharing VSCode Configuration

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

Add a `.vscode/extensions.json` to recommend extensions:

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

- ESLint handles code quality and Prettier handles code formatting, each doing its own job.
- `eslint-config-prettier` resolves rule conflicts between the two.
- `husky` + `lint-staged` auto-fixes on commit, keeping the main branch's code style consistent.
- Sharing the VSCode config ensures every member gets consistent formatting results.
- For legacy projects, adopt it incrementally to avoid conflicts caused by a large one-time change.
