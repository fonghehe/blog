---
title: "Webpack 5 Beta 新特性預覽"
date: 2020-02-06 11:01:12
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 5 已經進入 Beta 階段，雖然還沒正式發佈，但新特性值得關注。梳理一下對我們日常開發影響最大的幾個變化。"
wordCount: 267
---

Webpack 5 已經進入 Beta 階段，雖然還沒正式發佈，但新特性值得關注。梳理一下對我們日常開發影響最大的幾個變化。

## Module Federation：微前端的官方解法

這是 Webpack 5 最重磅的特性，允許多個獨立構建的應用共享模塊：

```javascript
// app1/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app1',
      filename: 'remoteEntry.js',
      exposes: {
        // 暴露組件給其他應用使用
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

// app2 中使用 app1 的組件
const Button = () => import('app1/Button');
```

這意味着微前端不再需要 iframe 或 single-spa 那麼重的方案了。

## 持久化緩存

Webpack 5 內置了持久化緩存，不再需要 `hard-source-webpack-plugin`：

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename], // 配置文件變更時失效
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },
};
```

實測：二次構建時間從 45 秒降到 8 秒。

## 資源模塊 (Asset Modules)

內置了資源處理，不再需要 `file-loader`、`url-loader`、`raw-loader`：

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
        type: 'asset', // 自動選擇 inline 或 external
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
      },
      {
        test: /\.txt$/,
        type: 'asset/source', // 相當於 raw-loader
      },
      {
        test: /\.svg$/,
        type: 'asset/resource', // 相當於 file-loader
      },
    ],
  },
};
```

## Tree Shaking 增強

```javascript
// package.json 中聲明 sideEffects
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}

// Webpack 5 新增：
// 1. 嵌套 tree shaking：連嵌套模塊的導出也能分析
// 2. 內部模塊 tree shaking：模塊內部的導出也能被 shake
// 3. CommonJS tree shaking：對 CommonJS 也生效（部分場景）

// 新增 optimization.usedExports 和 innerGraph
module.exports = {
  optimization: {
    usedExports: true,
    innerGraph: true, // 新：分析模塊內部的依賴圖
  },
};
```

## 最小 Node.js 版本

Webpack 5 要求 Node.js >= 10.13.0。在升級前確認 CI 環境。

## 遷移注意事項

```bash
# 升級命令
npm install webpack@next webpack-cli@latest -D

# 需要同步升級的插件
npm install -D webpack-dev-server@latest html-webpack-plugin@next

# 可能需要移除的（已內置）
npm uninstall file-loader url-loader raw-loader hard-source-webpack-plugin
```

```javascript
// 常見報錯及修復
// 1. Buffer 不再 polyfill
// 需要手動安裝 buffer
resolve: {
  fallback: {
    buffer: require.resolve('buffer/'),
  },
}

// 2. process 不再 polyfill
// 安裝 process/browser
resolve: {
  fallback: {
    process: require.resolve('process/browser'),
  },
}
```

## 小結

- Module Federation 是微前端的重大突破，值得深入研究
- 持久化緩存大幅縮短二次構建時間
- Asset Modules 簡化了資源處理配置
- Tree Shaking 更智能，產出更小
- Node.js 最低版本要求提升到 10.13.0，升級前檢查環境
