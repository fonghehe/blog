---
title: "Webpack Production Optimization Checklist"
date: 2019-12-18 15:38:29
tags:
  - Webpack
  - Engineering
readingTime: 4
description: "Webpack 4 已经相当成熟，但生产环境的优化配置依然让人头疼。这篇文章整理了我们团队在实际项目中使用的 Webpack 优化清单，覆盖压缩、Tree Shaking、代码分割、持久缓存、体积分析等环节。每个优化点都给出可直接使用的配置代码。"
wordCount: 434
---

Webpack 4 已经相当成熟，但生产环境的优化配置依然让人头疼。这篇文章整理了我们团队在实际项目中使用的 Webpack 优化清单，覆盖压缩、Tree Shaking、代码分割、持久缓存、体积分析等环节。每个优化点都给出可直接使用的配置代码。

## Code Minification

Webpack 4 的 `mode: 'production'` 默认开启 TerserPlugin 压缩 JS。但我们可以进一步调整配置：

```javascript
// webpack.config.js
const TerserPlugin = require('terser-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')

module.exports = {
  mode: 'production',

  optimization: {
    minimizer: [
      // JS 压缩
      new TerserPlugin({
        parallel: true,          // 多进程并行压缩
        cache: true,             // 开启缓存（Webpack 5 无需此配置）
        terserOptions: {
          compress: {
            drop_console: true,  // 移除 console.log
            drop_debugger: true, // 移除 debugger
            passes: 2,           // 压缩遍历次数
          },
          output: {
            comments: false,     // 移除注释
          },
        },
        extractComments: false,  // 不提取 license 到单独文件
      }),

      // CSS 压缩
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

## Tree Shaking Verification

Tree Shaking 在 `mode: 'production'` 下自动开启，但要确保它真正生效，需要注意几个条件：

```javascript
// 条件一：使用 ES Module 导出（不要混用 CommonJS）
// utils.js - 正确
export function add(a, b) { return a + b }
export function subtract(a, b) { return a - b }
export function multiply(a, b) { return a * b }

// 错误写法（Tree Shaking 无法生效）
// module.exports = { add, subtract, multiply }

// 条件二：按需导入
import { add } from './utils'
// 而不是
import * as utils from './utils'

// 条件三：在 package.json 中标记 sideEffects
// package.json
{
  "name": "my-project",
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfills.js"
  ]
  // 如果没有任何副作用，可以设为 false
  // "sideEffects": false
}
```

验证 Tree Shaking 是否生效的方法：

```bash
# 方法一：使用 Webpack Bundle Analyzer 查看
npm install --save-dev webpack-bundle-analyzer

# 方法二：搜索打包产物中的死代码
# 如果 multiply 函数没有被使用，打包产物中不应包含它
grep "multiply" dist/main.js

# 方法三：使用 --display-used-exports 查看
npx webpack --mode production --display-used-exports
```

## Code Splitting Strategies

代码分割是优化加载性能最有效的手段。我们采用多层级的分割策略：

```javascript
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      minSize: 30000,           // 模块超过 30KB 才分割
      maxSize: 244000,          // 超过 244KB 进一步拆分
      minChunks: 1,
      maxAsyncRequests: 6,      // 并行加载的最大请求数
      maxInitialRequests: 4,    // 入口最大并行请求数
      automaticNameDelimiter: '~',
      cacheGroups: {
        // 核心框架单独打包（变化频率最低）
        vendors: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'vendors',
          priority: 30,
          chunks: 'all',
          reuseExistingChunk: true,
        },

        // 其他第三方库
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: 'commons',
          priority: 20,
          chunks: 'all',
          reuseExistingChunk: true,
        },

        // 公共模块
        shared: {
          name: 'shared',
          minChunks: 2,         // 被至少 2 个 chunk 引用
          priority: 10,
          reuseExistingChunk: true,
        },

        // CSS 单独打包
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true,
        },
      },
    },

    // 提取 Webpack 运行时，避免 vendors hash 变化
    runtimeChunk: {
      name: 'runtime',
    },
  },
}
```

路由级别的动态导入：

```javascript
// 路由懒加载
import React, { Suspense, lazy } from 'react'

// 不要写成这样（所有页面打包在一起）
// import Home from './pages/Home'
// import Dashboard from './pages/Dashboard'

// 使用动态导入实现按需加载
const Home = lazy(() => import(/* webpackChunkName: "home" */ './pages/Home'))
const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ './pages/Dashboard'))
const Settings = lazy(() => import(/* webpackChunkName: "settings" */ './pages/Settings'))
const User = lazy(() => import(/* webpackChunkName: "user" */ './pages/User'))

function App() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
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

## Persistent Cache

通过 contenthash 实现长期缓存，文件内容不变则 hash 不变，浏览器可以使用缓存：

```javascript
module.exports = {
  output: {
    // contenthash: 基于文件内容生成 hash
    // 文件没变 -> hash 不变 -> 浏览器使用缓存
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
  },

  optimization: {
    // 提取 runtime 到单独文件
    // Webpack 的运行时代码很小但会频繁变化
    // 单独打包可以避免 vendors 的 hash 变化
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
      // 注入 CDN 前缀（可选）
      cdn: {
        css: ['https://cdn.example.com/lib/antd.min.css'],
        js: ['https://cdn.example.com/lib/react.production.min.js'],
      },
    }),
  ],
}
```

## Bundle Size Analysis

定期分析包体积是保持项目健康的关键：

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

module.exports = {
  plugins: [
    // 仅在 ANALYZE 环境变量下开启
    process.env.ANALYZE && new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      reportFilename: 'bundle-report.html',
      openAnalyzer: false,
    }),
  ].filter(Boolean),
}
```

```bash
# 运行分析
ANALYZE=true npx webpack --mode production
# 生成 bundle-report.html，在浏览器中打开查看

# 常见的体积优化发现：
# 1. moment.js 体积巨大（~300KB），考虑替换为 dayjs（~2KB）
# 2. lodash 按需引入
# import debounce from 'lodash/debounce' 而不是 import _ from 'lodash'
# 3. 检查是否有重复打包的依赖
```

## Complete Production Configuration

把上面所有优化整合到一个配置文件中：

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
  devtool: 'source-map', // 生产环境使用 source-map 便于错误追踪

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
          dataUrlCondition: { maxSize: 8 * 1024 }, // 8KB 以下转 base64
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

## Summary

- TerserPlugin 是默认的 JS 压缩器，开启 parallel 和 drop_console 可以提升压缩效率
- Tree Shaking 需要 ES Module + 按需导入 + sideEffects 标记三个条件同时满足
- 代码分割按 vendors/chunks/共享模块三层拆分，配合路由懒加载效果最佳
- contenthash 实现持久缓存，runtimeChunk 避免 vendors hash 变化导致缓存失效
- 定期用 Bundle Analyzer 分析体积，大库考虑按需引入或替换更轻量的替代品
- moment.js (300KB) 替换为 dayjs (2KB)、lodash 全量引入改为按路径引入，是最常见的体积优化
