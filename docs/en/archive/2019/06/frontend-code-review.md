---
title: "Frontend Code Review Essentials"
date: 2019-06-27 16:43:22
tags:
  - Frontend
readingTime: 1
description: "The team has recently been rolling out Code Review. I've compiled a frontend CR checklist. In practice, it's not just about finding bugs — it's a way to share k"
wordCount: 146
---

The team has recently been rolling out Code Review. I've compiled a frontend CR checklist. In practice, it's not just about finding bugs — it's a way to share knowledge.

## Code Style Consistency

Code with inconsistent style is painful to read. In 2019, ESLint + Prettier is the standard combination.

**ESLint configuration in the project root**:

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "prettier", // must be last to disable rules that conflict with Prettier
  ],
  plugins: ["react", "react-hooks"],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  env: {
    browser: true,
    node: true,
    jest: true,
    es6: true,
  },
  rules: {
    // React Hooks rules (new in 2019)
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Common rules
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: ["error", "always"],
  },
};
```

**Prettier configuration**:

```json
// .prettierrc
{
  "singleQuote": true,
  "semi": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Editor auto-format (VS Code)**:

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

Add `husky` + `lint-staged` to enforce checks before every commit:

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,scss}": ["prettier --write"]
  }
}
```

## CR Checklist

Beyond style, look for:

1. **Correctness**: does the logic match the requirements? Are edge cases handled?
2. **Performance**: unnecessary re-renders? Memory leaks? Expensive operations in loops?
3. **Security**: XSS vulnerabilities? Sensitive data exposure? Input validation?
4. **Readability**: are variable/function names meaningful? Is complex logic commented?
5. **Testability**: can key logic be unit tested?

Code review is most effective when it's a two-way conversation — reviewers explain their reasoning, authors explain their decisions.
