---
title: "Webpack 5 Beta New Features Preview"
date: 2020-02-06 11:01:12
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "Webpack 5 has entered beta. It isn't officially released yet, but its new features are worth watching. Here's a rundown of the changes that will affect day-to-day development the most."
wordCount: 176
---

Webpack 5 has entered the Beta stage. It isn't officially released yet, but its new features are worth watching. Here's a rundown of the changes that affect our day-to-day development the most.

## Module Federation: The Official Solution for Micro-Frontends

This is the headline feature of Webpack 5 — it lets multiple independently built applications share modules:

```javascript
// app1/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app1',
      filename: 'remoteEntry.js',
      exposes: {
        // 暴露组件给其他应用使用
        './Button': './src/components/Button',
        './utils': './src/utils/helpers',
      },
      shared: {
        vue: { singleton: true },
        'vue-router': { singleton: true },
      },
    }),
  ],
};

// app2/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app2',
      remotes: {
        app1: 'app1@http://localhost:3001/remoteEntry.js',
      },
      shared: {
        vue: { singleton: true },
        'vue-router': { singleton: true },
      },
    }),
  ],
};

// app2 中使用 app1 的组件
const Button = () => import('app1/Button');
```

This means micro-frontends no longer need heavyweight solutions like iframes or single-spa.

## Persistent Caching

Webpack 5 has built-in persistent caching, so you no longer need `hard-source-webpack-plugin`:

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename], // 配置文件变更时失效
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
};
```

In practice, the second build dropped from 45 seconds to 8 seconds.

## Asset Modules

Asset handling is built in, so you no longer need `file-loader`, `url-loader`, or `raw-loader`:

```javascript
// Webpack 4
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        use: [
          {
            loader: 'url-loader',
            options: { limit: 8192 },
          },
        ],
      },
    ],
  },
};

// Webpack 5
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset', // 自动选择 inline 或 external
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
      },
      {
        test: /\.txt$/,
        type: 'asset/source', // 相当于 raw-loader
      },
      {
        test: /\.svg$/,
        type: 'asset/resource', // 相当于 file-loader
      },
    ],
  },
};
```

## Enhanced Tree Shaking

```javascript
// package.json 中声明 sideEffects
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}

// Webpack 5 新增：
// 1. 嵌套 tree shaking：连嵌套模块的导出也能分析
// 2. 内部模块 tree shaking：模块内部的导出也能被 shake
// 3. CommonJS tree shaking：对 CommonJS 也生效（部分场景）

// 新增 optimization.usedExports 和 innerGraph
module.exports = {
  optimization: {
    usedExports: true,
    innerGraph: true, // 新：分析模块内部的依赖图
  },
};
```

## Minimum Node.js Version

Webpack 5 requires Node.js >= 10.13.0. Check your CI environment before upgrading.

## Migration Notes

```bash
# 升级命令
npm install webpack@next webpack-cli@latest -D

# 需要同步升级的插件
npm install -D webpack-dev-server@latest html-webpack-plugin@next

# 可能需要移除的（已内置）
npm uninstall file-loader url-loader raw-loader hard-source-webpack-plugin
```

```javascript
// 常见报错及修复
// 1. Buffer 不再 polyfill
// 需要手动安装 buffer
resolve: {
  fallback: {
    buffer: require.resolve('buffer/'),
  },
}

// 2. process 不再 polyfill
// 安装 process/browser
resolve: {
  fallback: {
    process: require.resolve('process/browser'),
  },
}
```

## Summary

- Module Federation is a major breakthrough for micro-frontends and worth studying in depth
- Persistent caching dramatically shortens second-build times
- Asset Modules simplify asset-handling configuration
- Tree Shaking is smarter and produces smaller output
- The minimum Node.js version is now 10.13.0 — check your environment before upgrading
