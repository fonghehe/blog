---
title: "2018 前端工具鏈總結"
date: 2018-12-24 17:28:57
tags:
  - 前端
readingTime: 2
description: "快到年底了，把今年用過的前端工具做個彙總，順便記錄一下各工具的定位和選型思路。"
wordCount: 541
---

快到年底了，把今年用過的前端工具做個彙總，順便記錄一下各工具的定位和選型思路。

## 構建工具

**Webpack 4**（主力）

- 適合：複雜應用，需要程式碼分割、Tree Shaking、各種 loader
- 特點：功能最全，生態最豐富，配置也最複雜
- 當年版本：4.0（二月釋出），顯著提升了構建速度

**Parcel**（備選）

- 適合：快速原型、簡單專案，零設定
- 特點：開箱即用，不需要設定檔案
- 用過一次做內部工具，確實快

**Rollup**（庫打包）

- 適合：打包 JS 庫，生成乾淨的 ESM/CJS 格式
- 特點：Tree Shaking 比 Webpack 早支援，bundle 更小
- 釋出 npm 包時用這個

## 包管理

**yarn**（當前主力）

- lockfile 更可靠，安裝速度更快
- workspace 支援 monorepo

**npm 6**（也在用）

- 今年更新後速度提升很多
- package-lock.json 更完善了

## 程式碼質量

**ESLint**

- 用 `eslint-config-airbnb` 作為基礎規則
- 配合 Vue 用 `eslint-plugin-vue`
- 提交程式碼前用 lint-staged 自動檢查

**Prettier**

- 程式碼格式統一
- 和 ESLint 配合：ESLint 管邏輯錯誤，Prettier 管格式

**husky + lint-staged**

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,vue}": ["eslint --fix", "git add"],
    "*.{css,scss}": ["stylelint --fix", "git add"]
  }
}
```

## 框架和庫

**Vue 2.5**（工作專案）

- Vuex 3.x
- Vue Router 3.x
- Element UI（桌面端）
- Vant（移動端）

**React 16.x**（自學）

- Redux + Redux Thunk
- React Router v4

**TypeScript 3.x**

- 今年開始在新專案上用
- 比 JS 的型別安全確實香

## HTTP

**axios**（幾乎所有專案都用）

- 封裝攔截器統一處理認證和錯誤
- 支援取消請求

## 測試

**Jest**（單元測試）

- Vue Test Utils 配套

**Cypress**（E2E，剛開始用）

- 可以錄製使用者操作生成測試

## 開發體驗

**VS Code**（主力編輯器）

- Vetur（Vue 支援）
- ESLint 外掛
- Prettier 外掛
- GitLens

**Chrome DevTools**

- Performance 面板（效能分析）
- Network 面板（網路分析）
- Application 面板（localStorage、Service Worker）

## 明年想關注的工具

```
Vite（尤雨溪在做，基於 ES module 的開發伺服器）→ 還早，但值得關注
TypeScript 3.x 新特性
React Hooks（提案階段）→ 感覺會改變 React 生態
```

## 小結

工具要選適合的，不是越新越好：

- 複雜應用 → Webpack
- 快速原型 → Parcel
- 釋出庫 → Rollup
- 程式碼質量 → ESLint + Prettier + lint-staged（必配）
- TypeScript 值得投入，提升開發體驗和重構信心

2018 是前端工具鏈快速演進的一年，期待 2019 年有更多驚喜。
