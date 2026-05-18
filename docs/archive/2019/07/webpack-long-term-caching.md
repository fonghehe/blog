---
title: "Webpack DllPlugin 加速构建"
date: 2019-07-29 14:58:32
tags:
  - Webpack
  - 工程化
readingTime: 5
description: "Webpack 项目一大痛点就是构建速度慢。一个中型项目，`node_modules` 里几百个包，每次 `npm run build` 都要等好几分钟。`DllPlugin` 是 Webpack 官方提供的构建优化方案之一，核心思路是把不常变化的依赖（如 React、Vue、lodash 等）提前打包成一个独立的 D"
---

Webpack 项目一大痛点就是构建速度慢。一个中型项目，`node_modules` 里几百个包，每次 `npm run build` 都要等好几分钟。`DllPlugin` 是 Webpack 官方提供的构建优化方案之一，核心思路是把不常变化的依赖（如 React、Vue、lodash 等）提前打包成一个独立的 DLL 文件，主构建时直接引用，不再重复编译。

## DllPlugin 原理

```
第一次构建（生成 DLL）：
  react, react-dom, lodash, axios
  -> 打包成 vendor.dll.js + vendor.manifest.json
  -> 耗时：一次性开销

后续构建（主构建）：
  读取 manifest.json -> 知道 DLL 中已经包含哪些模块
  跳过这些模块的解析和编译 -> 只编译业务代码
  -> 耗时：大幅减少
```

## 完整配置

### 第一步：创建 DLL 构建配置

```javascript
// webpack.dll.config.js
const path = require('path')
const webpack = require('webpack')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: {
    // 把不常变化的依赖打包进 DLL
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
    library: '[name]_library'  // 暴露为全局变量，供 DllReferencePlugin 引用
  },
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DllPlugin({
      name: '[name]_library',
      path: path.resolve(__dirname, 'dll/[name].manifest.json')
      // manifest.json 记录了模块 ID 和文件路径的映射关系
    })
  ]
}
```

### 第二步：在主构建中引用 DLL

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
    // 引用 DLL，告诉 Webpack 这些模块已经打包好了，不需要重复处理
    new webpack.DllReferencePlugin({
      manifest: require('./dll/vendor.manifest.json')
    }),

    new HtmlWebpackPlugin({
      template: './public/index.html',
      // 注意：需要手动把 dll.js 文件引入到 HTML 中
      // 可以用 AddAssetHtmlPlugin 自动注入
    })
  ]
}
```

### 第三步：自动注入 DLL 到 HTML

手动在 HTML 模板中引入 `vendor.dll.js` 太麻烦了。用 `add-asset-html-webpack-plugin` 自动处理：

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

    // 自动把 DLL 文件注入到 HTML 中
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

### 第四步：配置 npm scripts

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

- `npm run dll`：单独生成 DLL（只在依赖变化时需要执行）
- `npm run build`：先生成 DLL 再构建
- `npm run build:main`：跳过 DLL 生成，直接主构建（日常开发用这个）

## 多个 DLL 分包

如果项目很大，可以把 DLL 拆成多个：

```javascript
// webpack.dll.config.js
module.exports = {
  entry: {
    // React 生态
    react: ['react', 'react-dom', 'react-router-dom', 'redux', 'react-redux'],
    // 工具库
    utils: ['axios', 'lodash', 'moment', 'classnames'],
    // UI 组件库
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

主构建中引用多个 DLL：

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

## 与 HardSourceWebpackPlugin 对比

2019 年另一个流行的构建加速方案是 `HardSourceWebpackPlugin`，它通过缓存模块的编译结果来加速。

| 特性 | DllPlugin | HardSourceWebpackPlugin |
|
------|-----------|------------------------|
| 原理 | 预打包不变的依赖 | 缓存所有模块的编译结果 |
| 首次构建 | 需要先构建 DLL | 没有加速效果 |
| 后续构建 | DLL 中的模块跳过编译 | 所有模块从缓存恢复 |
| 依赖变化 | 需要重新构建 DLL | 自动增量更新 |
| 配置复杂度 | 需要单独的 DLL 配置文件 | 一行配置即可 |
| 适用场景 | 依赖稳定的大型项目 | 任何项目 |

```javascript
// HardSourceWebpackPlugin 配置（非常简单）
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')

module.exports = {
  plugins: [
    new HardSourceWebpackPlugin()
    // 就这一行，其余交给它自动处理
  ]
}
```

### 能不能同时用？

可以。`DllPlugin` 减少首次构建时间（跳过依赖编译），`HardSourceWebpackPlugin` 加速后续构建（缓存编译结果）。两者互补：

```javascript
plugins: [
  new webpack.DllReferencePlugin({
    manifest: require('./dll/vendor.manifest.json')
  }),
  new HardSourceWebpackPlugin(),
  new AddAssetHtmlPlugin(/* ... */)
]
```

## 实际效果

在一个中型 React 项目（约 150 个模块）上测试：

| 场景 | 不优化 | 只用 DllPlugin | 只用 HardSource | 两者都用 |
|------|--------|--------------|----------------|---------|
| 冷启动构建 | 45s | 35s | 45s | 35s |
| 二次构建 | 45s | 35s | 8s | 6s |
| 依赖更新后 | 45s | 45s | 15s | 15s |

可以看到：
- `DllPlugin` 主要减少冷启动时间（省去依赖编译）
- `HardSourceWebpackPlugin` 主要加速二次构建
- 两者结合效果最好

## 踩坑记录

### 坑 1：DLL 构建后忘记重新构建

添加了新依赖后，需要重新运行 `npm run dll`，否则主构建会找不到新模块。

解决：在 `package.json` 的 `postinstall` 中自动重建 DLL：

```json
{
  "scripts": {
    "postinstall": "npm run dll"
  }
}
```

但这样每次 `npm install` 都会重建 DLL，可能比较慢。更好的方式是用一个检查脚本：

```javascript
// scripts/check-dll.js
const fs = require('fs')
const path = require('path')
const pkg = require('../package.json')

const dllEntry = require('../webpack.dll.config.js').entry.vendor
const manifestPath = path.resolve(__dirname, '../dll/vendor.manifest.json')

if (!fs.existsSync(manifestPath)) {
  console.log('DLL manifest 不存在，需要构建 DLL')
  process.exit(1) // 触发重建
}

console.log('DLL 已存在，跳过')
```

### 坑 2：DllPlugin 和 scope hoisting 冲突

`ModuleConcatenationPlugin`（scope hoisting）可能会导致 DLL 中的模块 ID 变化，与 manifest 不匹配。

解决：DLL 构建配置中关闭 scope hoisting：

```javascript
// webpack.dll.config.js
module.exports = {
  optimization: {
    concatenateModules: false
  }
}
```

### 坑 3：DLL 文件版本管理

DLL 文件体积通常较大（几十 MB），是否提交到 Git？

建议：
- 小团队、CI/CD 完善：不提交，CI 中构建
- 没有 CI：提交到 Git，让团队共享

```ini
# 如果不提交
dll/
```

### 坑 4：开发模式下的 sourcemap

DLL 文件在开发时也需要 sourcemap，否则调试时找不到源码：

```javascript
// webpack.dll.config.js（开发用）
module.exports = {
  mode: 'development',
  devtool: 'source-map',
  // ...
}
```

## 小结

- DllPlugin 的核心原理：把不常变化的依赖预打包，主构建时跳过这些模块的编译
- 配置三步走：创建 DLL 构建配置 -> 主构建用 DllReferencePlugin 引用 -> 用 AddAssetHtmlPlugin 注入 HTML
- HardSourceWebpackPlugin 通过缓存编译结果加速，和 DllPlugin 互补
- 依赖变化后需要重新构建 DLL，可以在 postinstall 中自动处理
- DLL 文件体积大，需要决定是否提交到版本控制
- 现代 Webpack 5 中 DllPlugin 的使用场景减少（因为有更好的持久化缓存方案），但在 Webpack 4 时代是构建加速的重要手段
