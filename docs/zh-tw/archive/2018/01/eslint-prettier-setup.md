---
title: "ESLint + Prettier 工程化規範設定實踐"
date: 2018-01-30 11:21:56
tags:
  - 工程化
readingTime: 2
description: "程式碼規範是團隊協作的基礎設施。每次 Code Review 花時間討論縮排和引號風格是在浪費所有人的時間。ESLint + Prettier 的組合可以把這類問題自動化掉。"
---

程式碼規範是團隊協作的基礎設施。每次 Code Review 花時間討論縮排和引號風格是在浪費所有人的時間。ESLint + Prettier 的組合可以把這類問題自動化掉。

## ESLint 和 Prettier 的分工

這兩個工具經常被混淆，但它們解決的是不同的問題：

- **ESLint**：程式碼品質檢查，找出潛在 bug 和不良實踐（未使用的變數、`==` 而不是 `===`、循環引用等）
- **Prettier**：程式碼格式化，統一縮排、引號、行寬、逗號等純風格問題

它們應該配合使用，而不是選一個。

## 基礎安裝

```bash
npm install --save-dev \
  eslint \
  prettier \
  eslint-config-prettier \     # 停用與 Prettier 衝突的 ESLint 規則
  eslint-plugin-prettier \     # 把 Prettier 作為 ESLint 規則執行
  babel-eslint               # 讓 ESLint 理解新語法（可選）
```

React 專案額外安裝：

```bash
npm install --save-dev \
  eslint-plugin-react \
  eslint-plugin-react-hooks   # React Hooks 規則（React 16.7+）
```

Vue 專案額外安裝：

```bash
npm install --save-dev eslint-plugin-vue
```

## ESLint 設定

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
    "plugin:react/recommended", // React 推薦規則（React 專案）
    "prettier", // 停用與 Prettier 衝突的規則（必須放最後）
    "prettier/react",
  ],

  plugins: ["prettier"],

  rules: {
    // Prettier 格式問題作為 ESLint error
    "prettier/prettier": "error",

    // 自訂規則
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
      version: "detect", // 自動偵測 React 版本
    },
  },
};
```

## Prettier 設定

```javascript
// .prettierrc.js
module.exports = {
  // 基礎格式
  printWidth: 100, // 每行最大字元數
  tabWidth: 2, // 縮排寬度
  useTabs: false, // 用空格而非 Tab
  semi: false, // 不加分號（視團隊習慣）
  singleQuote: true, // 用單引號

  // 物件和陣列
  trailingComma: "es5", // ES5 合法的地方加尾逗號（物件、陣列，不含函式參數）
  bracketSpacing: true, // { foo: bar } 加空格

  // JSX
  jsxSingleQuote: false, // JSX 屬性用雙引號
  jsxBracketSameLine: false, // JSX > 不和最後一個屬性同行
};
```

關於是否加分號、單雙引號，這些沒有絕對對錯，重要的是全團隊一致。設定檔提交到 git，爭論就此終止。

## 設定 .eslintignore 和 .prettierignore

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

用 `husky` + `lint-staged` 在 git commit 前自動 lint 和格式化：

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

這個設定的效果：每次 `git commit` 時，只對本次修改的檔案（而不是全量）執行 lint 和格式化，速度快，不影響未改動的檔案。

## VSCode 編輯器整合

安裝 ESLint 和 Prettier 擴充套件後，設定編輯器自動格式化：

```json
// .vscode/settings.json（提交到 git，統一團隊編輯器設定）
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

在現有專案上推行程式碼規範，別一次性把所有規則都打開——會產生幾百個 error，團隊不會買單。建議分階段：

1. **第一步**：只開 Prettier，統一格式，零 error
2. **第二步**：開啟 `eslint:recommended`，修復已有問題
3. **第三步**：逐步添加團隊約定的自訂規則

每一步都確保 CI 通過、存量程式碼合規，再進行下一步。

---

_1 月內容完結。2 月繼續。_
