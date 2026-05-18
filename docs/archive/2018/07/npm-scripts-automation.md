---
title: "npm scripts 自动化工作流"
date: 2018-07-12 17:30:27
tags:
  - TypeScript
readingTime: 1
description: "很多人只用 npm scripts 跑 `npm start` 和 `npm run build`，其实它能做很多自动化的事情。"
---

很多人只用 npm scripts 跑 `npm start` 和 `npm run build`，其实它能做很多自动化的事情。

## 基础

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

运行：`npm run dev`（`start`、`test` 可以省略 run）

## 串行与并行

```json
{
  "scripts": {
    // 串行：&& 前一个失败则停止
    "build": "npm run lint && npm run compile && npm run minify",

    // 并行：& 同时运行（Unix），或用 npm-run-all
    "dev": "npm run server & npm run watch",

    // 用 npm-run-all（跨平台）
    "dev": "npm-run-all --parallel server watch",
    "build": "npm-run-all lint compile minify"
  }
}
```

```bash
npm install --save-dev npm-run-all
```

## 传递参数

```bash
# -- 后面的参数传给脚本
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

## 生命周期钩子

npm 提供 pre/post 钩子：

```json
{
  "scripts": {
    "prebuild": "npm run clean", // build 前自动执行
    "build": "webpack --mode production",
    "postbuild": "npm run zip-dist", // build 后自动执行

    "pretest": "npm run lint", // 测试前先检查代码
    "test": "jest"
  }
}
```

## 实用脚本集合

```json
{
  "scripts": {
    // 清理构建目录
    "clean": "rimraf dist",

    // 分析包大小
    "analyze": "webpack-bundle-analyzer stats.json",

    // 检查依赖更新
    "deps:check": "ncu",
    "deps:update": "ncu -u && npm install",

    // 生成 changelog
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",

    // 版本发布
    "release:patch": "npm version patch && npm publish",
    "release:minor": "npm version minor && npm publish",

    // 启动后自动打开浏览器
    "dev": "webpack-dev-server --open",

    // 格式化所有文件
    "format": "prettier --write \"src/**/*.{js,vue,css,scss}\"",

    // 全量检查（CI 用）
    "ci": "npm run lint && npm run test && npm run build"
  }
}
```

## 环境变量

```json
{
  "scripts": {
    // cross-env 跨平台设置环境变量
    "build:staging": "cross-env NODE_ENV=production VUE_APP_ENV=staging webpack",
    "build:prod": "cross-env NODE_ENV=production VUE_APP_ENV=production webpack"
  }
}
```

```bash
npm install --save-dev cross-env rimraf
```

## 脚本里使用 node

直接在 scripts 里写 node 脚本：

```json
{
  "scripts": {
    "gen-icons": "node scripts/generate-icons.js",
    "update-version": "node -e \"require('./scripts/bump-version')()\"",
    "check-size": "node -e \"const s = require('./dist/main.js').length; console.log('Size:', (s/1024).toFixed(1)+'KB')\""
  }
}
```

## 小结

- `pre`/`post` 钩子做自动化串联
- `npm-run-all` 处理并行/串行任务，跨平台
- `cross-env` 跨平台设置环境变量
- 把常用操作都写成 script，文档化并标准化团队工作流
