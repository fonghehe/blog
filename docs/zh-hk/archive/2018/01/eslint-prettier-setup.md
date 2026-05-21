---
title: "ESLint + Prettier 工程化規範配置實踐"
date: 2018-01-30 11:21:56
tags:
  - 工程化
readingTime: 2
description: "代碼規範係團隊協作嘅基礎設施。每次 Code Review 花時間討論縮進同引號風格係在浪費所有人嘅時間。ESLint + Prettier 嘅組合可以將呢類問題自動化掉。"
wordCount: 461
---

代碼規範係團隊協作嘅基礎設施。每次 Code Review 花時間討論縮進同引號風格係在浪費所有人嘅時間。ESLint + Prettier 嘅組合可以將呢類問題自動化掉。

## ESLint 同 Prettier 嘅分工

呢兩個工具經常被混淆，但佢哋解決嘅係唔同嘅問題：

- **ESLint**：代碼質量檢查，搵出潛在 bug 同不良實踐（未使用嘅變量、`==` 而唔係 `===`、循環引用等）
- **Prettier**：代碼格式化，統一縮進、引號、行寬、逗號等純風格問題

佢哋應該配合使用，而唔係揀一個。

## 基礎安裝

```bash
npm install --save-dev \
  eslint \
  prettier \
  eslint-config-prettier \     # 禁用同 Prettier 衝突嘅 ESLint 規則
  eslint-plugin-prettier \     # 將 Prettier 作為 ESLint 規則運行
  babel-eslint               # 讓 ESLint 理解新語法（可選）
```

React 項目額外安裝：

```bash
npm install --save-dev \
  eslint-plugin-react \
  eslint-plugin-react-hooks   # React Hooks 規則（React 16.7+）
```

Vue 項目額外安裝：

```bash
npm install --save-dev eslint-plugin-vue
```

## ESLint 配置

```javascript
// .eslintrc.js
module.exports = {
  parser: "babel-eslint",

  env: {
    browser: true,
    es6: true,
    node: true,
  },

  extends: [
    "eslint:recommended", // ESLint 推薦規則
    "plugin:react/recommended", // React 推薦規則（React 項目）
    "prettier", // 禁用同 Prettier 衝突嘅規則（必須放最後）
    "prettier/react",
  ],

  plugins: ["prettier"],

  rules: {
    // Prettier 格式問題作為 ESLint error
    "prettier/prettier": "error",

    // 自定義規則
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "prefer-const": "error",
    "no-var": "error",

    // React 相關
    "react/prop-types": "warn",
    "react/display-name": "off",
  },

  settings: {
    react: {
      version: "detect", // 自動檢測 React 版本
    },
  },
};
```

## Prettier 配置

```javascript
// .prettierrc.js
module.exports = {
  // 基礎格式
  printWidth: 100, // 每行最大字符數
  tabWidth: 2, // 縮進寬度
  useTabs: false, // 用空格而非 Tab
  semi: false, // 唔加分號（視團隊習慣）
  singleQuote: true, // 用單引號

  // 對象同數組
  trailingComma: "es5", // ES5 合法嘅地方加尾逗號（對象、數組，唔含函數參數）
  bracketSpacing: true, // { foo: bar } 加空格

  // JSX
  jsxSingleQuote: false, // JSX 屬性用雙引號
  jsxBracketSameLine: false, // JSX > 唔同最後一個屬性同行
};
```

關於係咪加分號、單雙引號，呢啲冇絕對對錯，重要係全團隊一致。配置文件提交到 git，爭論就此終止。

## 配置 .eslintignore 同 .prettierignore

```
# .eslintignore
node_modules/
dist/
build/
coverage/
*.min.js
public/

# .prettierignore
node_modules/
dist/
build/
package-lock.json
yarn.lock
```

## 整合到 npm scripts

```json
// package.json
{
  "scripts": {
    "lint": "eslint src --ext .js,.jsx,.vue",
    "lint:fix": "eslint src --ext .js,.jsx,.vue --fix",
    "format": "prettier --write 'src/**/*.{js,jsx,css,vue,json}'"
  }
}
```

## Git Hooks：提交前自動檢查

用 `husky` + `lint-staged` 喺 git commit 前自動 lint 同格式化：

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
    "src/**/*.{js,jsx}": ["eslint --fix", "prettier --write", "git add"],
    "src/**/*.{css,scss}": ["prettier --write", "git add"]
  }
}
```

呢個配置嘅效果：每次 `git commit` 時，只對本次修改嘅文件（而唔係全量）運行 lint 同格式化，速度快，唔影響未改動嘅文件。

## VSCode 編輯器整合

安裝 ESLint 同 Prettier 擴展後，配置編輯器自動格式化：

```json
// .vscode/settings.json（提交到 git，統一團隊編輯器配置）
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.autoFixOnSave": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    { "language": "vue", "autoFix": true }
  ]
}
```

## 落地建議

喺現有項目上推行代碼規範，唔好一次過將所有規則都打開——會產生幾百個 error，團隊唔會接受。建議分階段：

1. **第一步**：只開 Prettier，統一格式，零 error
2. **第二步**：開啟 `eslint:recommended`，修復已有問題
3. **第三步**：逐步添加團隊約定嘅自定義規則

每一步都確保 CI 通過、存量代碼合規，再進行下一步。

---

_1 月內容完結。2 月繼續。_
