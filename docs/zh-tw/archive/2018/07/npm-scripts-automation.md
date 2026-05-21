---
title: "npm scripts 自動化工作流"
date: 2018-07-12 17:30:27
tags:
  - TypeScript
readingTime: 1
description: "很多人只用 npm scripts 跑 `npm start` 和 `npm run build`，其實它能做很多自動化的事情。"
wordCount: 144
---

很多人只用 npm scripts 跑 `npm start` 和 `npm run build`，其實它能做很多自動化的事情。

## 基礎

```json
{
  "scripts": {
    "dev": "webpack-dev-server --mode development",
    "build": "webpack --mode production",
    "lint": "eslint src --ext .js,.vue",
    "test": "jest"
  }
}
```

執行：`npm run dev`（`start`、`test` 可以省略 run）

## 序列與並行

```json
{
  "scripts": {
    // 序列：&& 前一個失敗則停止
    "build": "npm run lint && npm run compile && npm run minify",

    // 並行：& 同時執行（Unix），或用 npm-run-all
    "dev": "npm run server & npm run watch",

    // 用 npm-run-all（跨平臺）
    "dev": "npm-run-all --parallel server watch",
    "build": "npm-run-all lint compile minify"
  }
}
```

```bash
npm install --save-dev npm-run-all
```

## 傳遞引數

```bash
# -- 後面的引數傳給指令碼
npm run build -- --watch
npm run lint -- --fix
```

```json
{
  "scripts": {
    "lint": "eslint src",
    "lint:fix": "npm run lint -- --fix"
  }
}
```

## 生命週期鉤子

npm 提供 pre/post 鉤子：

```json
{
  "scripts": {
    "prebuild": "npm run clean", // build 前自動執行
    "build": "webpack --mode production",
    "postbuild": "npm run zip-dist", // build 後自動執行

    "pretest": "npm run lint", // 測試前先檢查程式碼
    "test": "jest"
  }
}
```

## 實用指令碼集合

```json
{
  "scripts": {
    // 清理構建目錄
    "clean": "rimraf dist",

    // 分析包大小
    "analyze": "webpack-bundle-analyzer stats.json",

    // 檢查依賴更新
    "deps:check": "ncu",
    "deps:update": "ncu -u && npm install",

    // 生成 changelog
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",

    // 版本釋出
    "release:patch": "npm version patch && npm publish",
    "release:minor": "npm version minor && npm publish",

    // 啟動後自動開啟瀏覽器
    "dev": "webpack-dev-server --open",

    // 格式化所有檔案
    "format": "prettier --write \"src/**/*.{js,vue,css,scss}\"",

    // 全量檢查（CI 用）
    "ci": "npm run lint && npm run test && npm run build"
  }
}
```

## 環境變數

```json
{
  "scripts": {
    // cross-env 跨平臺設定環境變數
    "build:staging": "cross-env NODE_ENV=production VUE_APP_ENV=staging webpack",
    "build:prod": "cross-env NODE_ENV=production VUE_APP_ENV=production webpack"
  }
}
```

```bash
npm install --save-dev cross-env rimraf
```

## 腳本里使用 node

直接在 scripts 裡寫 node 指令碼：

```json
{
  "scripts": {
    "gen-icons": "node scripts/generate-icons.js",
    "update-version": "node -e \"require('./scripts/bump-version')()\"",
    "check-size": "node -e \"const s = require('./dist/main.js').length; console.log('Size:', (s/1024).toFixed(1)+'KB')\""
  }
}
```

## 小結

- `pre`/`post` 鉤子做自動化串聯
- `npm-run-all` 處理並行/序列任務，跨平臺
- `cross-env` 跨平臺設定環境變數
- 把常用操作都寫成 script，文件化並標準化團隊工作流
