---
title: "Webpack DllPlugin 加速構建：實踐方法與治理思路"
date: 2019-07-29 14:58:32
tags:
  - Webpack
  - 工程化
readingTime: 5
description: "Webpack 項目一大痛點就是構建速度慢。一箇中型項目，`node_modules` 裏幾百個包，每次 `npm run build` 都要等好幾分鐘。`DllPlugin` 是 Webpack 官方提供的構建優化方案之一，核心思路是把不常變化的依賴（如 React、Vue、lodash 等）提前打包成一個獨立的 D"
wordCount: 920
---

Webpack 項目一大痛點就是構建速度慢。一箇中型項目，`node_modules` 裏幾百個包，每次 `npm run build` 都要等好幾分鐘。`DllPlugin` 是 Webpack 官方提供的構建優化方案之一，核心思路是把不常變化的依賴（如 React、Vue、lodash 等）提前打包成一個獨立的 DLL 文件，主構建時直接引用，不再重複編譯。

## DllPlugin 原理

```
第一次構建（生成 DLL）：
  react, react-dom, lodash, axios
  -> 打包成 vendor.dll.js + vendor.manifest.json
  -> 耗時：一次性開銷

後續構建（主構建）：
  讀取 manifest.json -> 知道 DLL 中已經包含哪些模塊
  跳過這些模塊的解析和編譯 -> 隻編譯業務代碼
  -> 耗時：大幅減少
```

## 完整設定

### 第一步：創建 DLL 構建設定

```javascript
// webpack.dll.config.js
const path = require('path')
const webpack = require('webpack')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: {
    // 把不常變化的依賴打包進 DLL
    vendor: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'lodash',
      'moment'
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dll'),
    filename: '[name].dll.js',
    library: '[name]_library'  // 暴露為全局變量，供 DllReferencePlugin 引用
  },
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DllPlugin({
      name: '[name]_library',
      path: path.resolve(__dirname, 'dll/[name].manifest.json')
      // manifest.json 記錄了模塊 ID 和文件路徑的映射關係
    })
  ]
}
```

### 第二步：在主構建中引用 DLL

```javascript
// webpack.config.js
const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash:8].js'
  },
  plugins: [
    // 引用 DLL，告訴 Webpack 這些模塊已經打包好了，不需要重複處理
    new webpack.DllReferencePlugin({
      manifest: require('./dll/vendor.manifest.json')
    }),

    new HtmlWebpackPlugin({
      template: './public/index.html',
      // 注意：需要手動把 dll.js 檔案引入到 HTML 中
      // 可以用 AddAssetHtmlPlugin 自動注入
    })
  ]
}
```

### 第三步：自動注入 DLL 到 HTML

手動在 HTML 模板中引入 `vendor.dll.js` 太麻煩了。用 `add-asset-html-webpack-plugin` 自動處理：

```bash
npm install add-asset-html-webpack-plugin --save-dev
```

```javascript
// webpack.config.js
const AddAssetHtmlPlugin = require('add-asset-html-webpack-plugin')

module.exports = {
  plugins: [
    new webpack.DllReferencePlugin({
      manifest: require('./dll/vendor.manifest.json')
    }),

    // 自動把 DLL 文件注入到 HTML 中
    new AddAssetHtmlPlugin({
      filepath: path.resolve(__dirname, 'dll/*.dll.js'),
      outputPath: 'dll',
      publicPath: '/dll'
    }),

    new HtmlWebpackPlugin({
      template: './public/index.html'
    })
  ]
}
```

### 第四步：設定 npm scripts

```json
{
  "scripts": {
    "dll": "webpack --config webpack.dll.config.js",
    "build": "npm run dll && webpack --config webpack.config.js",
    "build:dll": "npm run dll",
    "build:main": "webpack --config webpack.config.js"
  }
}
```

- `npm run dll`：單獨生成 DLL（隻在依賴變化時需要執行）
- `npm run build`：先生成 DLL 再構建
- `npm run build:main`：跳過 DLL 生成，直接主構建（日常開發用這個）

## 多個 DLL 分包

如果項目很大，可以把 DLL 拆成多個：

```javascript
// webpack.dll.config.js
module.exports = {
  entry: {
    // React 生態
    react: ['react', 'react-dom', 'react-router-dom', 'redux', 'react-redux'],
    // 工具庫
    utils: ['axios', 'lodash', 'moment', 'classnames'],
    // UI 組件庫
    ui: ['antd']
  },
  output: {
    path: path.resolve(__dirname, 'dll'),
    filename: '[name].dll.js',
    library: '[name]_library'
  },
  plugins: [
    new webpack.DllPlugin({
      name: '[name]_library',
      path: path.resolve(__dirname, 'dll/[name].manifest.json')
    })
  ]
}
```

主構建中引用多個 DLL：

```javascript
// webpack.config.js
plugins: [
  new webpack.DllReferencePlugin({
    manifest: require('./dll/react.manifest.json')
  }),
  new webpack.DllReferencePlugin({
    manifest: require('./dll/utils.manifest.json')
  }),
  new webpack.DllReferencePlugin({
    manifest: require('./dll/ui.manifest.json')
  }),
  new AddAssetHtmlPlugin({
    filepath: path.resolve(__dirname, 'dll/*.dll.js'),
    outputPath: 'dll',
    publicPath: '/dll'
  })
]
```

## 與 HardSourceWebpackPlugin 對比

2019 年另一個流行的構建加速方案是 `HardSourceWebpackPlugin`，它通過緩存模塊的編譯結果來加速。

| 特性 | DllPlugin | HardSourceWebpackPlugin |
|
------|-----------|------------------------|
| 原理 | 預打包不變的依賴 | 緩存所有模塊的編譯結果 |
| 首次構建 | 需要先構建 DLL | 沒有加速效果 |
| 後續構建 | DLL 中的模塊跳過編譯 | 所有模塊從緩存恢復 |
| 依賴變化 | 需要重新構建 DLL | 自動增量更新 |
| 設定複雜度 | 需要單獨的 DLL 設定檔案 | 一行設定即可 |
| 適用場景 | 依賴穩定的大型項目 | 任何項目 |

```javascript
// HardSourceWebpackPlugin 配置（非常簡單）
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')

module.exports = {
  plugins: [
    new HardSourceWebpackPlugin()
    // 就這一行，其餘交給它自動處理
  ]
}
```

### 能不能同時用？

可以。`DllPlugin` 減少首次構建時間（跳過依賴編譯），`HardSourceWebpackPlugin` 加速後續構建（緩存編譯結果）。兩者互補：

```javascript
plugins: [
  new webpack.DllReferencePlugin({
    manifest: require('./dll/vendor.manifest.json')
  }),
  new HardSourceWebpackPlugin(),
  new AddAssetHtmlPlugin(/* ... */)
]
```

## 實際效果

在一箇中型 React 項目（約 150 個模塊）上測試：

| 場景 | 不優化 | 隻用 DllPlugin | 隻用 HardSource | 兩者都用 |
|------|--------|--------------|----------------|---------|
| 冷啓動構建 | 45s | 35s | 45s | 35s |
| 二次構建 | 45s | 35s | 8s | 6s |
| 依賴更新後 | 45s | 45s | 15s | 15s |

可以看到：
- `DllPlugin` 主要減少冷啓動時間（省去依賴編譯）
- `HardSourceWebpackPlugin` 主要加速二次構建
- 兩者結合效果最好

## 踩坑記錄

### 坑 1：DLL 構建後忘記重新構建

添加了新依賴後，需要重新運行 `npm run dll`，否則主構建會找不到新模塊。

解決：在 `package.json` 的 `postinstall` 中自動重建 DLL：

```json
{
  "scripts": {
    "postinstall": "npm run dll"
  }
}
```

但這樣每次 `npm install` 都會重建 DLL，可能比較慢。更好的方式是用一個檢查腳本：

```javascript
// scripts/check-dll.js
const fs = require('fs')
const path = require('path')
const pkg = require('../package.json')

const dllEntry = require('../webpack.dll.config.js').entry.vendor
const manifestPath = path.resolve(__dirname, '../dll/vendor.manifest.json')

if (!fs.existsSync(manifestPath)) {
  console.log('DLL manifest 不存在，需要構建 DLL')
  process.exit(1) // 觸發重建
}

console.log('DLL 已存在，跳過')
```

### 坑 2：DllPlugin 和 scope hoisting 衝突

`ModuleConcatenationPlugin`（scope hoisting）可能會導致 DLL 中的模塊 ID 變化，與 manifest 不匹配。

解決：DLL 構建配置中關閉 scope hoisting：

```javascript
// webpack.dll.config.js
module.exports = {
  optimization: {
    concatenateModules: false
  }
}
```

### 坑 3：DLL 檔案版本管理

DLL 文件體積通常較大（幾十 MB），是否提交到 Git？

建議：
- 小團隊、CI/CD 完善：不提交，CI 中構建
- 沒有 CI：提交到 Git，讓團隊共享

```ini
# 如果不提交
dll/
```

### 坑 4：開發模式下的 sourcemap

DLL 檔案在開發時也需要 sourcemap，否則調試時找不到源碼：

```javascript
// webpack.dll.config.js（開發用）
module.exports = {
  mode: 'development',
  devtool: 'source-map',
  // ...
}
```

## 小結

- DllPlugin 的核心原理：把不常變化的依賴預打包，主構建時跳過這些模塊的編譯
- 配置三步走：創建 DLL 構建配置 -> 主構建用 DllReferencePlugin 引用 -> 用 AddAssetHtmlPlugin 注入 HTML
- HardSourceWebpackPlugin 通過緩存編譯結果加速，和 DllPlugin 互補
- 依賴變化後需要重新構建 DLL，可以在 postinstall 中自動處理
- DLL 檔案體積大，需要決定是否提交到版本控製
- 現代 Webpack 5 中 DllPlugin 的使用場景減少（因為有更好的持久化緩存方案），但在 Webpack 4 時代是構建加速的重要手段
