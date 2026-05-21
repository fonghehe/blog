---
title: "Webpack 4 正式發佈：Zero Config 體驗與升級指南"
date: 2018-02-03 11:07:33
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 4 在 2 月底正式發佈，最大的亮點是 **zero configuration**——不寫配置文件也能跑起來。升級了幾個項目，記錄一下實際體驗。"
wordCount: 393
---

Webpack 4 在 2 月底正式發佈，最大的亮點是 **zero configuration**——不寫配置文件也能跑起來。升級了幾個項目，記錄一下實際體驗。

## 最明顯的變化：mode

Webpack 4 引入了 `mode` 參數，取值 `development` 或 `production`：

```bash
webpack --mode production
webpack --mode development
```

`production` 模式自動開啓：

- `TerserPlugin`（代碼壓縮）
- `ModuleConcatenationPlugin`（Scope Hoisting）
- `NoEmitOnErrorsPlugin`
- 各種優化配置

`development` 模式自動開啓：

- `NamedChunksPlugin`
- `NamedModulesPlugin`
- 更好的錯誤提示

以前這些都要手動配，現在大部分項目直接設 mode 就夠了。

## 構建速度提升

官方宣稱速度提升 98%（極端測試條件），實際項目測下來提升 30%-60%，但已經很明顯了。

主要原因：

- 引入了持久化緩存（`cache` 選項）
- 優化了模塊解析算法
- 減少了 plugin 內部開銷

## 升級步驟

### 1. 更新依賴

```bash
npm uninstall webpack webpack-dev-server
npm install webpack@4 webpack-cli@3 webpack-dev-server@3

# webpack-cli 從 webpack 包裏分離出來了，必須單獨裝
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

### 3. 移除廢棄配置

Webpack 4 刪除了一些舊 API：

```javascript
// 以前
module.exports = {
  entry: './src/index.js',
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({ ... })  // ❌ 已刪除
    new webpack.optimize.UglifyJsPlugin()             // ❌ 已刪除
  ]
}

// 現在
module.exports = {
  entry: './src/index.js',
  mode: 'production',
  optimization: {
    splitChunks: {           // ✅ CommonsChunkPlugin 的替代
      chunks: 'all'
    }
  }
  // UglifyJS 在 production mode 下自動啓用
}
```

### 4. 更新 mini-css-extract-plugin

原來的 `extract-text-webpack-plugin` 在 Webpack 4 下有兼容問題，換成新的：

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

這是改動最大的部分。新的 `optimization.splitChunks` 更靈活：

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
          minChunks: 2, // 至少被 2 個入口共用才提取
          chunks: "initial",
          priority: -20,
        },
      },
    },
  },
};
```

## 升級踩坑記錄

**問題 1：loader 報錯 `this.getOptions is not a function`**

原因：一些老 loader 沒適配 Webpack 4，需要升級 loader 版本。

**問題 2：`vue-loader` 需要升級**

```bash
npm install vue-loader@15 vue-template-compiler
```

Vue Loader 15 需要配合 `VueLoaderPlugin`：

```javascript
const { VueLoaderPlugin } = require("vue-loader");

module.exports = {
  plugins: [
    new VueLoaderPlugin(), // 必加，否則 .vue 文件不解析
  ],
};
```

**問題 3：`webpack-dev-server` 配置項改名**

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

## 小結

Webpack 4 的升級還是有收益的，構建速度和包體積都有改善。主要成本是處理各種 plugin/loader 的兼容性問題，建議先在小項目試手，再遷移大項目。
