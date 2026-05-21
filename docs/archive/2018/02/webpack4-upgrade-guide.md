---
title: "Webpack 4 正式发布：Zero Config 体验与升级指南"
date: 2018-02-03 11:07:33
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 4 在 2 月底正式发布，最大的亮点是 **zero configuration**——不写配置文件也能跑起来。升级了几个项目，记录一下实际体验。"
wordCount: 393
---

Webpack 4 在 2 月底正式发布，最大的亮点是 **zero configuration**——不写配置文件也能跑起来。升级了几个项目，记录一下实际体验。

## 最明显的变化：mode

Webpack 4 引入了 `mode` 参数，取值 `development` 或 `production`：

```bash
webpack --mode production
webpack --mode development
```

`production` 模式自动开启：

- `TerserPlugin`（代码压缩）
- `ModuleConcatenationPlugin`（Scope Hoisting）
- `NoEmitOnErrorsPlugin`
- 各种优化配置

`development` 模式自动开启：

- `NamedChunksPlugin`
- `NamedModulesPlugin`
- 更好的错误提示

以前这些都要手动配，现在大部分项目直接设 mode 就够了。

## 构建速度提升

官方宣称速度提升 98%（极端测试条件），实际项目测下来提升 30%-60%，但已经很明显了。

主要原因：

- 引入了持久化缓存（`cache` 选项）
- 优化了模块解析算法
- 减少了 plugin 内部开销

## 升级步骤

### 1. 更新依赖

```bash
npm uninstall webpack webpack-dev-server
npm install webpack@4 webpack-cli@3 webpack-dev-server@3

# webpack-cli 从 webpack 包里分离出来了，必须单独装
```

### 2. 更新 package.json scripts

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack-dev-server --mode development --open"
  }
}
```

### 3. 移除废弃配置

Webpack 4 删除了一些旧 API：

```javascript
// 以前
module.exports = {
  entry: './src/index.js',
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({ ... })  // ❌ 已删除
    new webpack.optimize.UglifyJsPlugin()             // ❌ 已删除
  ]
}

// 现在
module.exports = {
  entry: './src/index.js',
  mode: 'production',
  optimization: {
    splitChunks: {           // ✅ CommonsChunkPlugin 的替代
      chunks: 'all'
    }
  }
  // UglifyJS 在 production mode 下自动启用
}
```

### 4. 更新 mini-css-extract-plugin

原来的 `extract-text-webpack-plugin` 在 Webpack 4 下有兼容问题，换成新的：

```bash
npm install mini-css-extract-plugin
```

```javascript
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
  ],
};
```

## splitChunks：CommonsChunkPlugin 的新替代

这是改动最大的部分。新的 `optimization.splitChunks` 更灵活：

```javascript
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // 'async' | 'initial' | 'all'
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: -10,
        },
        common: {
          name: "common",
          minChunks: 2, // 至少被 2 个入口共用才提取
          chunks: "initial",
          priority: -20,
        },
      },
    },
  },
};
```

## 升级踩坑记录

**问题 1：loader 报错 `this.getOptions is not a function`**

原因：一些老 loader 没适配 Webpack 4，需要升级 loader 版本。

**问题 2：`vue-loader` 需要升级**

```bash
npm install vue-loader@15 vue-template-compiler
```

Vue Loader 15 需要配合 `VueLoaderPlugin`：

```javascript
const { VueLoaderPlugin } = require("vue-loader");

module.exports = {
  plugins: [
    new VueLoaderPlugin(), // 必加，否则 .vue 文件不解析
  ],
};
```

**问题 3：`webpack-dev-server` 配置项改名**

```javascript
// Webpack 3
devServer: {
  contentBase: "./dist";
}

// Webpack 4
devServer: {
  static: "./dist"; // contentBase 改成了 static（部分版本）
}
```

## 小结

Webpack 4 的升级还是有收益的，构建速度和包体积都有改善。主要成本是处理各种 plugin/loader 的兼容性问题，建议先在小项目试手，再迁移大项目。
