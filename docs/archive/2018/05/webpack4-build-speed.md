---
title: "Webpack 4 性能优化：构建速度篇"
date: 2018-05-03 14:57:54
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "随着项目规模增长，Webpack 构建时间越来越长，每次等待都是效率损耗。这篇文章整理实测有效的构建速度优化手段。"
---

随着项目规模增长，Webpack 构建时间越来越长，每次等待都是效率损耗。这篇文章整理实测有效的构建速度优化手段。

## 测量：先找瓶颈

优化前先知道时间花在哪里：

```bash
npm install --save-dev speed-measure-webpack-plugin
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  // 你的 webpack 配置
});
```

输出会显示每个 loader 和 plugin 的耗时，找出最慢的再优化。

## 优化 1：缩小构建范围

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "babel-loader",
        include: path.resolve(__dirname, "src"), // 只处理 src
        exclude: /node_modules/, // 排除 node_modules
      },
    ],
  },
  resolve: {
    // 告诉 webpack 去哪里找模块
    modules: [path.resolve(__dirname, "src"), "node_modules"],
    // 减少文件扩展名搜索
    extensions: [".js", ".vue"], // 不加 .json .css，按需添加
    // 模块别名（避免层级深的相对路径）
    alias: {
      "@": path.resolve(__dirname, "src"),
      vue$: "vue/dist/vue.esm.js", // 明确指定文件，避免搜索
    },
  },
};
```

## 优化 2：babel-loader 缓存

```javascript
{
  test: /\.js$/,
  use: {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true  // 开启缓存，二次构建快很多
    }
  }
}
```

第一次构建慢，后续构建只处理变化的文件。

## 优化 3：多线程构建

```bash
npm install --save-dev thread-loader
```

```javascript
{
  test: /\.js$/,
  use: [
    {
      loader: 'thread-loader',
      options: { workers: 2 }  // 工作线程数，CPU 核数 - 1
    },
    'babel-loader'
  ]
}
```

**注意**：开启多线程有开销，只对计算量大的 loader 才有收益。

## 优化 4：DLL 预编译

把不常变化的第三方库（React、Vue、Element UI）预先编译，开发时直接引用：

```javascript
// webpack.dll.js
const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: {
    vendor: ["vue", "vuex", "vue-router", "axios", "element-ui"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_[hash]",
  },
  plugins: [
    new webpack.DllPlugin({
      path: path.join(__dirname, "dll", "[name]-manifest.json"),
      name: "[name]_[hash]",
    }),
  ],
};
```

```bash
# 先构建 DLL（只需要运行一次，依赖变化时重跑）
webpack --config webpack.dll.js
```

```javascript
// webpack.config.js 引用 DLL
plugins: [
  new webpack.DllReferencePlugin({
    context: __dirname,
    manifest: require("./dll/vendor-manifest.json"),
  }),
];
```

**实测：** vendor 包含 Vue 全家桶 + Element UI，构建时间从 45s 降到 12s。

## 优化 5：hard-source-webpack-plugin

模块级别的缓存，比 DLL 更容易配置：

```bash
npm install --save-dev hard-source-webpack-plugin
```

```javascript
const HardSourceWebpackPlugin = require("hard-source-webpack-plugin");

plugins: [new HardSourceWebpackPlugin()];
```

第一次构建时间不变，第二次开始有显著提升（60%+ 的速度提升）。

## 效果对比

以一个中型 Vue 项目为例（约 200 个组件）：

| 优化项            | 构建时间   |
| 
----------------- | ---------- |
| 原始              | 48s        |
| babel-loader 缓存 | 32s        |
| + DLL             | 18s        |
| + thread-loader   | 14s        |
| + hard-source     | 8s（二次） |

## 分析是否还有空间

```bash
# 分析打包结果
npm install --save-dev webpack-bundle-analyzer

# 构建后查看
# 是否有意外打进去的大模块？
# 有没有重复打包？
```

## 小结

- 先测量，用 `speed-measure-webpack-plugin` 找瓶颈
- `babel-loader` 开缓存是最简单的优化
- DLL 预编译对第三方库效果显著
- `hard-source-webpack-plugin` 是快速见效的全局缓存方案
- 不要盲目开多线程，线程数过多反而变慢
