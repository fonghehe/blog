---
title: "Webpack 4 正式釋出：Zero Config 體驗與升級指南"
date: 2018-02-03 11:07:33
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 4 在 2 月底正式釋出，最大的亮點是 **zero configuration**——不寫配置檔案也能跑起來。升級了幾個專案，記錄一下實際體驗。"
wordCount: 396
---

Webpack 4 在 2 月底正式釋出，最大的亮點是 **zero configuration**——不寫配置檔案也能跑起來。升級了幾個專案，記錄一下實際體驗。

## 最明顯的變化：mode

Webpack 4 引入了 `mode` 引數，取值 `development` 或 `production`：

```bash
webpack --mode production
webpack --mode development
```

`production` 模式自動開啟：

- `TerserPlugin`（程式碼壓縮）
- `ModuleConcatenationPlugin`（Scope Hoisting）
- `NoEmitOnErrorsPlugin`
- 各種最佳化配置

`development` 模式自動開啟：

- `NamedChunksPlugin`
- `NamedModulesPlugin`
- 更好的錯誤提示

以前這些都要手動配，現在大部分專案直接設 mode 就夠了。

## 構建速度提升

官方宣稱速度提升 98%（極端測試條件），實際專案測下來提升 30%-60%，但已經很明顯了。

主要原因：

- 引入了持久化快取（`cache` 選項）
- 優化了模組解析演算法
- 減少了 plugin 內部開銷

## 升級步驟

### 1. 更新依賴

```bash
npm uninstall webpack webpack-dev-server
npm install webpack@4 webpack-cli@3 webpack-dev-server@3

# webpack-cli 從 webpack 包裡分離出來了，必須單獨裝
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
  // UglifyJS 在 production mode 下自動啟用
}
```

### 4. 更新 mini-css-extract-plugin

原來的 `extract-text-webpack-plugin` 在 Webpack 4 下有相容問題，換成新的：

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
    new VueLoaderPlugin(), // 必加，否則 .vue 檔案不解析
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

Webpack 4 的升級還是有收益的，構建速度和包體積都有改善。主要成本是處理各種 plugin/loader 的相容性問題，建議先在小專案試手，再遷移大專案。
