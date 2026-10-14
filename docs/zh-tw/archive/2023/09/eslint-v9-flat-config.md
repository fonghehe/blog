---
title: "ESLint v9 Flat Config：設定結構與遷移檢查"
date: 2023-09-08 15:28:03
updated: 2026-10-24
version: "ESLint 9.x (historical migration)"
tags:
  - ESLint
readingTime: 2
wordCount: 503
description: "回顧 ESLint v9 的 Flat Config 設定陣列、檔案匹配、忽略規則與遷移驗證，區分歷史發布日期和後續修訂。"
---

> 修訂說明：保留原始歸檔日期與連結，本文於 2026-10-24 重寫。ESLint v9 正式版發布於 2024-04-05，以下是後續整理的遷移說明，不代表 2023 年該版本已正式發布。ESLint v9 已結束官方維護，新專案應參考官方版本支援表選擇仍受維護的版本。

Flat Config 的重點是用 JavaScript 模組匯出設定陣列。符合相同檔案的多個設定物件依序組合，後面的同名規則可以覆蓋前面的值；`files` 決定物件套用至哪些檔案。

## 一個設定陣列

以下針對歷史上的 ESLint 9 與 `@eslint/js` 9，說明遷移結構。這是教學設定，不包含正式環境部署或效能驗證的聲明。

```javascript
// eslint.config.mjs — historical ESLint 9 example
import js from '@eslint/js'

export default [
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: { 'no-unused-vars': 'warn' },
  },
]
```

`js.configs.recommended` 提供建議規則，最後一個物件為 JavaScript 檔案調整特定規則。只有 `ignores` 的物件表達全域忽略規則。瀏覽器或 Node.js 全域變數、TypeScript 解析器、Vue 單檔元件解析器和框架外掛需要另外設定，不能把這個範例當作所有專案的完整設定。

## 遷移時檢查什麼

1. 固定 ESLint 與外掛版本，確認支援 Flat Config 及對應 ESLint 主版本。
2. 將舊設定的 `env`、`parserOptions`、`globals` 逐項對應至新格式，不只變更檔名。
3. 把忽略路徑移入設定。Flat Config 不會自動保留舊 `.eslintignore` 的行為，須重新檢查路徑匹配。
4. 對目標檔案執行 `npx eslint --print-config src/example.js`，確認最終規則與語言選項。
5. 分別檢查應通過、應報錯和應忽略的檔案，再執行完整 lint。通過 lint 不代表業務功能已驗證。

## 版本與更新

本篇保留 v9 的遷移背景；目前專案請以實際版本的官方文件為準，不把設定範例標記成正式環境驗證案例。

## 參考資料

- [ESLint v9.0.0 release — 2024-04-05](https://eslint.org/blog/2024/04/eslint-v9.0.0-released/)
- [ESLint v9 configuration migration guide](https://eslint.org/docs/v9.x/use/configure/migration-guide)
- [ESLint version support](https://eslint.org/version-support/)
