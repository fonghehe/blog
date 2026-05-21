---
title: "ESLint + Prettier Engineering Standards in Practice"
date: 2018-01-30 11:21:56
tags:
  - Engineering
readingTime: 1
description: "ESLint and Prettier are often seen together, but they do different things. Many tutorials mix them up. Let's separate their concerns."
wordCount: 139
---

ESLint and Prettier are often seen together, but they do different things. Many tutorials mix them up. Let's separate their concerns.

## Division of Responsibilities

- **ESLint**: code quality checks (unused variables, unreachable code, potential errors)
- **Prettier**: code formatting (indentation, quotes, semicolons, line length)

When they conflict, defer formatting decisions entirely to Prettier. Don't use ESLint to enforce formatting style.

## Installation and Configuration

```bash
npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier
# For Vue projects add:
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
    "plugin:vue/essential", // or plugin:vue/recommended
    "prettier", // disable ESLint formatting rules (must be last)
  ],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": "error", // Prettier violations = ESLint errors
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
  },
};
```

```javascript
// .prettierrc.js
module.exports = {
  semi: false, // no semicolons
  singleQuote: true, // single quotes
  printWidth: 100, // max line length
  trailingComma: "es5", // trailing commas where valid in ES5
  tabWidth: 2, // 2-space indentation
  endOfLine: "lf", // LF line endings (important for cross-platform teams)
};
```

## npm Scripts

```json
{
  "scripts": {
    "lint": "eslint --ext .js,.vue src",
    "lint:fix": "eslint --ext .js,.vue src --fix",
    "format": "prettier --write src/**/*.{js,vue,css,scss}"
  }
}
```

## Git Hooks: Automated Enforcement

```bash
npm install --save-dev husky lint-staged
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
    "src/**/*.{js,vue}": ["eslint --fix", "git add"],
    "src/**/*.{css,scss,json,md}": ["prettier --write", "git add"]
  }
}
```

With this setup, the pre-commit hook runs lint-staged, which auto-fixes lint and format issues on staged files before the commit goes through.

## VS Code Integration

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

## Rollout Strategy for Existing Projects

For large codebases with inconsistent formatting:

1. Run `prettier --write` once to format everything uniformly — do this in a separate PR
2. Enable `lint-staged` to only check changed files going forward
3. Gradually enable stricter ESLint rules as the team adapts
