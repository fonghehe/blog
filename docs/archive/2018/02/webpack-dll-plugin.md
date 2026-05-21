---
title: "Webpack DllPlugin 加速开发构建"
date: 2018-02-21 15:30:47
tags:
  - Webpack
readingTime: 1
description: "项目越来越大，Webpack 冷启动越来越慢。DllPlugin 的思路是：把不经常变动的第三方库单独打包，之后每次构建就不用重新处理它们了。"
wordCount: 255
---

项目越来越大，Webpack 冷启动越来越慢。DllPlugin 的思路是：把不经常变动的第三方库单独打包，之后每次构建就不用重新处理它们了。

## 为什么需要 DllPlugin

```
每次 webpack 构建，都要处理：
  - 业务代码（经常变）
  - React/Vue/lodash/echarts 等第三方库（几乎不变）

DllPlugin 方案：
  - 把第三方库单独打包一次 → 生成 vendor.js + manifest.json
  - 之后每次构建，直接引用打好的 vendor.js
  - 跳过第三方库的处理，构建速度大幅提升
```

## 配置步骤

### Step 1：创建 dll 配置文件

```javascript
// webpack.dll.js
const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: {
    vendor: ["vue", "vue-router", "vuex", "axios", "lodash"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_lib", // 暴露给外部的变量名
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_lib",
      path: path.join(__dirname, "dll", "[name]-manifest.json"),
    }),
  ],
};
```

### Step 2：生成 dll 文件

```bash
# package.json 里加个命令
"scripts": {
  "dll": "webpack --config webpack.dll.js"
}

# 运行（依赖版本有变动时才需要重新跑）
npm run dll
```

执行后生成：

- `dll/vendor.dll.js`
- `dll/vendor-manifest.json`

### Step 3：在主配置里引用

```javascript
// webpack.config.js
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const AddAssetHtmlPlugin = require("add-asset-html-webpack-plugin");

module.exports = {
  plugins: [
    // 告诉 webpack 哪些模块不需要打包，去 dll 里找
    new webpack.DllReferencePlugin({
      manifest: require("./dll/vendor-manifest.json"),
    }),

    new HtmlWebpackPlugin({ template: "index.html" }),

    // 自动把 dll 文件注入 HTML
    new AddAssetHtmlPlugin({
      filepath: require.resolve("./dll/vendor.dll.js"),
    }),
  ],
};
```

## 效果对比

在我的项目（引入了 Vue、echarts、moment 等）：

```
不用 DllPlugin：冷启动 ~18s
用了 DllPlugin：冷启动 ~7s

提升约 60%
```

## 注意事项

```javascript
// 1. dll 里的依赖版本升级后，要重新运行 npm run dll
// 2. dll 文件要加进 .gitignore，每个人本地生成
// 3. 生产构建一般不用 DllPlugin（CI 每次都是全量构建）

// .gitignore
dll/
```

## 2018 年现状

DllPlugin 是当时（2018年）加速构建最有效的方案之一。不过 Webpack 4 的 cache 和 parallel 选项出来之后，DllPlugin 的收益相对降低了。如果你在用 Webpack 4，先试试 `cache-loader` 和 `thread-loader`，可能就够了。

## 小结

- DllPlugin：把第三方库单独打包，主构建跳过处理它们
- 步骤：创建 dll config → 运行一次生成 dll → 主 config 引用 manifest
- 适合：冷启动慢、第三方库多的项目
- Webpack 4 有更简单的缓存方案，可以先评估再用 DllPlugin