---
title: "Webpack 生產環境最佳化清單"
date: 2019-12-18 15:38:29
tags:
  - Webpack
  - 工程化
readingTime: 4
description: "Webpack 4 已經相當成熟，但生產環境的最佳化配置依然讓人頭疼。這篇文章整理了我們團隊在實際專案中使用的 Webpack 最佳化清單，覆蓋壓縮、Tree Shaking、程式碼分割、持久快取、體積分析等環節。每個最佳化點都給出可直接使用的配置程式碼。"
---

Webpack 4 已經相當成熟，但生產環境的最佳化配置依然讓人頭疼。這篇文章整理了我們團隊在實際專案中使用的 Webpack 最佳化清單，覆蓋壓縮、Tree Shaking、程式碼分割、持久快取、體積分析等環節。每個最佳化點都給出可直接使用的配置程式碼。

## 程式碼壓縮

Webpack 4 的 `mode: 'production'` 預設開啟 TerserPlugin 壓縮 JS。但我們可以進一步調整配置：

```javascript
// webpack.config.js
const TerserPlugin = require('terser-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')

module.exports = {
  mode: 'production',

  optimization: {
    minimizer: [
      // JS 壓縮
      new TerserPlugin({
        parallel: true,          // 多程序並行壓縮
        cache: true,             // 開啟快取（Webpack 5 無需此配置）
        terserOptions: {
          compress: {
            drop_console: true,  // 移除 console.log
            drop_debugger: true, // 移除 debugger
            passes: 2,           // 壓縮遍歷次數
          },
          output: {
            comments: false,     // 移除註釋
          },
        },
        extractComments: false,  // 不提取 license 到單獨檔案
      }),

      // CSS 壓縮
      new OptimizeCSSAssetsPlugin({
        cssProcessorOptions: {
          safe: true,
          discardComments: { removeAll: true },
        },
      }),
    ],
  },

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
    }),
  ],
}
```

## Tree Shaking 驗證

Tree Shaking 在 `mode: 'production'` 下自動開啟，但要確保它真正生效，需要注意幾個條件：

```javascript
// 條件一：使用 ES Module 匯出（不要混用 CommonJS）
// utils.js - 正確
export function add(a, b) { return a + b }
export function subtract(a, b) { return a - b }
export function multiply(a, b) { return a * b }

// 錯誤寫法（Tree Shaking 無法生效）
// module.exports = { add, subtract, multiply }

// 條件二：按需匯入
import { add } from './utils'
// 而不是
import * as utils from './utils'

// 條件三：在 package.json 中標記 sideEffects
// package.json
{
  "name": "my-project",
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfills.js"
  ]
  // 如果沒有任何副作用，可以設為 false
  // "sideEffects": false
}
```

驗證 Tree Shaking 是否生效的方法：

```bash
# 方法一：使用 Webpack Bundle Analyzer 檢視
npm install --save-dev webpack-bundle-analyzer

# 方法二：搜尋打包產物中的死程式碼
# 如果 multiply 函式沒有被使用，打包產物中不應包含它
grep "multiply" dist/main.js

# 方法三：使用 --display-used-exports 檢視
npx webpack --mode production --display-used-exports
```

## 程式碼分割策略

程式碼分割是最佳化載入效能最有效的手段。我們採用多層級的分割策略：

```javascript
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 30000,           // 模組超過 30KB 才分割
      maxSize: 244000,          // 超過 244KB 進一步拆分
      minChunks: 1,
      maxAsyncRequests: 6,      // 並行載入的最大請求數
      maxInitialRequests: 4,    // 入口最大並行請求數
      automaticNameDelimiter: '~',
      cacheGroups: {
        // 核心框架單獨打包（變化頻率最低）
        vendors: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'vendors',
          priority: 30,
          chunks: 'all',
          reuseExistingChunk: true,
        },

        // 其他第三方庫
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'commons',
          priority: 20,
          chunks: 'all',
          reuseExistingChunk: true,
        },

        // 公共模組
        shared: {
          name: 'shared',
          minChunks: 2,         // 被至少 2 個 chunk 引用
          priority: 10,
          reuseExistingChunk: true,
        },

        // CSS 單獨打包
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true,
        },
      },
    },

    // 提取 Webpack 執行時，避免 vendors hash 變化
    runtimeChunk: {
      name: 'runtime',
    },
  },
}
```

路由級別的動態匯入：

```javascript
// 路由懶載入
import React, { Suspense, lazy } from 'react'

// 不要寫成這樣（所有頁面打包在一起）
// import Home from './pages/Home'
// import Dashboard from './pages/Dashboard'

// 使用動態匯入實現按需載入
const Home = lazy(() => import(/* webpackChunkName: "home" */ './pages/Home'))
const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ './pages/Dashboard'))
const Settings = lazy(() => import(/* webpackChunkName: "settings" */ './pages/Settings'))
const User = lazy(() => import(/* webpackChunkName: "user" */ './pages/User'))

function App() {
  return (
    <Suspense fallback={<div>載入中...</div>}>
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/settings" component={Settings} />
        <Route path="/user/:id" component={User} />
      </Switch>
    </Suspense>
  )
}
```

## 持久快取

通過 contenthash 實現長期快取，檔案內容不變則 hash 不變，瀏覽器可以使用快取：

```javascript
module.exports = {
  output: {
    // contenthash: 基於檔案內容生成 hash
    // 檔案沒變 -> hash 不變 -> 瀏覽器使用快取
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
  },

  optimization: {
    // 提取 runtime 到單獨檔案
    // Webpack 的執行時程式碼很小但會頻繁變化
    // 單獨打包可以避免 vendors 的 hash 變化
    runtimeChunk: 'single',

    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
}
```

配合 HTML 模板和 CDN 部署：

```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
      },
      // 注入 CDN 字首（可選）
      cdn: {
        css: ['https://cdn.example.com/lib/antd.min.css'],
        js: ['https://cdn.example.com/lib/react.production.min.js'],
      },
    }),
  ],
}
```

## 體積分析

定期分析包體積是保持專案健康的關鍵：

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

module.exports = {
  plugins: [
    // 僅在 ANALYZE 環境變數下開啟
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
    }),
  ].filter(Boolean),
}
```

```bash
# 執行分析
ANALYZE=true npx webpack --mode production
# 生成 bundle-report.html，在瀏覽器中開啟檢視

# 常見的體積最佳化發現：
# 1. moment.js 體積巨大（~300KB），考慮替換為 dayjs（~2KB）
# 2. lodash 按需引入
#    import debounce from 'lodash/debounce' 而不是 import _ from 'lodash'
# 3. 檢查是否有重複打包的依賴
```

## 完整的生產配置

把上面所有最佳化整合到一個配置檔案中：

```javascript
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = {
  mode: 'production',
  devtool: 'source-map', // 生產環境使用 source-map 便於錯誤追蹤

  entry: {
    main: './src/index.tsx',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    publicPath: '/',
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: { maxSize: 8 * 1024 }, // 8KB 以下轉 base64
        },
        generator: {
          filename: 'images/[name].[contenthash:8][ext]',
        },
      },
    ],
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        terserOptions: {
          compress: { drop_console: true, passes: 2 },
          output: { comments: false },
        },
      }),
      new OptimizeCSSAssetsPlugin(),
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 20,
        },
      },
    },
    runtimeChunk: 'single',
  },

  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      minify: {
        removeComments: true,
        collapseWhitespace: true,
      },
    }),
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
    }),
    process.env.ANALYZE && new BundleAnalyzerPlugin(),
  ].filter(Boolean),
}
```

## 小結

- TerserPlugin 是預設的 JS 壓縮器，開啟 parallel 和 drop_console 可以提升壓縮效率
- Tree Shaking 需要 ES Module + 按需匯入 + sideEffects 標記三個條件同時滿足
- 程式碼分割按 vendors/chunks/共享模組三層拆分，配合路由懶載入效果最佳
- contenthash 實現持久快取，runtimeChunk 避免 vendors hash 變化導致快取失效
- 定期用 Bundle Analyzer 分析體積，大庫考慮按需引入或替換更輕量的替代品
- moment.js (300KB) 替換為 dayjs (2KB)、lodash 全量引入改為按路徑引入，是最常見的體積最佳化
