---
title: "Webpack 4 优化实战：让构建快 50%"
date: 2019-01-17 09:30:01
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "项目大了，构建速度慢得让人抓狂。这是我们团队 Webpack 4 优化的实战记录，构建时间从 3 分钟降到 90 秒。"
wordCount: 246
---

项目大了，构建速度慢得让人抓狂。这是我们团队 Webpack 4 优化的实战记录，构建时间从 3 分钟降到 90 秒。

## 1. 分析构建耗时

```bash
# 安装分析工具
npm i -D speed-measure-webpack-plugin webpack-bundle-analyzer
```

```javascript
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const smp = new SpeedMeasurePlugin();

module.exports = smp.wrap({
  plugins: [
    new BundleAnalyzerPlugin(), // 分析包大小
  ],
});
```

先看清楚慢在哪，再优化。

## 2. 多进程编译

```bash
npm i -D thread-loader
```

```javascript
// 耗时的 loader（babel-loader）放到 worker 进程
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: "thread-loader",
            options: {
              workers: require("os").cpus().length - 1,
              workerParallelJobs: 50,
            },
          },
          "babel-loader?cacheDirectory=true", // 开启缓存！
        ],
      },
    ],
  },
};
```

## 3. 缓存（关键优化）

```javascript
// cache-loader：缓存 loader 结果
{
  test: /\.js$/,
  use: ['cache-loader', 'thread-loader', 'babel-loader']
}

// 或者使用 HardSourceWebpackPlugin
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')
plugins: [new HardSourceWebpackPlugin()]

// babel-loader 自带缓存
{
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,
    cacheCompression: false  // 不压缩缓存，更快
  }
}
```

第一次构建后，后续构建快很多（我们从 3min → 90s）。

## 4. DllPlugin：预编译第三方库

```javascript
// webpack.dll.js：预编译 vendor
const webpack = require("webpack");
const path = require("path");

module.exports = {
  entry: {
    vendor: ["vue", "vue-router", "vuex", "axios", "element-ui"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_dll",
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_dll",
      path: path.join(__dirname, "dll/[name].manifest.json"),
    }),
  ],
};
```

```json
// package.json
{
  "scripts": {
    "dll": "webpack --config webpack.dll.js",
    "build": "webpack"
  }
}
```

```javascript
// webpack.config.js：使用预编译的 dll
new webpack.DllReferencePlugin({
  manifest: require("./dll/vendor.manifest.json"),
});
```

先 `npm run dll`（几乎不用重跑），后续 build 直接跳过这些库的编译。

## 5. 缩小 Loader 处理范围

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        // 不处理 node_modules（已经是 ES5）
        exclude: /node_modules/,
        // 或精确指定处理范围
        include: path.resolve(__dirname, "src"),
        use: "babel-loader",
      },
    ],
  },
  resolve: {
    // 减少查找：只找这些扩展名，顺序是优先级
    extensions: [".js", ".vue", ".json"],
    // alias 加速解析
    alias: {
      "@": path.resolve(__dirname, "src"),
      vue$: "vue/dist/vue.runtime.esm.js", // 用 runtime-only 版本（更小）
    },
    // 不去 node_modules 找依赖
    modules: [path.resolve(__dirname, "src"), "node_modules"],
  },
};
```

## 6. 生产构建特有优化

```javascript
// production 模式下 Webpack 4 自动开启：
// - Tree Shaking
// - Scope Hoisting（ModuleConcatenationPlugin）
// - TerserPlugin（压缩 JS）

module.exports = {
  mode: "production",
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
    // 只在文件内容改变时更新 hash（长期缓存）
    moduleIds: "hashed",
    runtimeChunk: "single",
  },
};
```

## 效果对比

| 场景               | 优化前   | 优化后   |
| 
------------------ | -------- | -------- |
| 首次构建           | 3min 20s | 2min 10s |
| 二次构建（有缓存） | 3min 10s | 1min 30s |
| 增量构建（dev）    | 8s       | 2s       |

## 小结

1. **先分析**：用 SpeedMeasurePlugin 找瓶颈
2. **缓存**：babel-loader + cache-loader，收益最大
3. **多进程**：thread-loader 处理耗时 loader
4. **DllPlugin**：预编译第三方库（Webpack 5 用 ModuleFederationPlugin 替代）
5. **精确范围**：exclude/include 减少不必要的处理
