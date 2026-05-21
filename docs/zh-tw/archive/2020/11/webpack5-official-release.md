---
title: "Webpack 5 正式版詳解"
date: 2020-11-03 14:36:42
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "Webpack 5 正式版釋出了。之前在 Beta 階段預覽過新特性，現在正式版出來後，做一次完整的升級實戰。"
wordCount: 176
---

Webpack 5 正式版釋出了。之前在 Beta 階段預覽過新特性，現在正式版出來後，做一次完整的升級實戰。

## 主要新特性回顧

```markdown
1. Module Federation：微前端模組共享
2. 持久化快取：大幅提升二次構建速度
3. Asset Modules：內建資源處理，替代 file/url-loader
4. 增強 Tree Shaking：支援巢狀和 CommonJS
5. 更好的程式碼分割
6. 移除 Node.js polyfill
```

## 持久化快取配置

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
    // 快取版本，配置變更時遞增
    version: '1.0',
  },
};

// 效果
// 首次構建：45 秒
// 二次構建：8 秒（利用快取）
// 配置變更：重新構建，但其他未變模組仍走快取
```

## Asset Modules

```javascript
module.exports = {
  module: {
    rules: [
      // 小於 8KB 的圖片內聯為 base64
      {
        test: /\.(png|jpg|gif|webp)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
        generator: {
          filename: 'images/[name].[contenthash:8][ext]',
        },
      },
      // SVG 作為獨立檔案
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: 'icons/[name].[contenthash:8][ext]',
        },
      },
      // 文本內容內聯
      {
        test: /\.txt$/,
        type: 'asset/source',
      },
      // 字型檔案
      {
        test: /\.(woff2?|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[contenthash:8][ext]',
        },
      },
    ],
  },
};
```

## Module Federation 實戰

```javascript
// 基座應用 webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        // 引入微應用
        userModule: 'userModule@http://localhost:3001/remoteEntry.js',
        orderModule: 'orderModule@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
        'vue-router': { singleton: true },
      },
    }),
  ],
};

// 微應用 webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'userModule',
      filename: 'remoteEntry.js',
      exposes: {
        './UserList': './src/components/UserList.vue',
        './UserForm': './src/components/UserForm.vue',
      },
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
      },
    }),
  ],
};

// 基座應用中載入微應用元件
const UserList = () => import('userModule/UserList');
const UserForm = () => import('userModule/UserForm');
```

## 增強的 Tree Shaking

```javascript
// package.json
{
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfills.js"
  ]
}

// webpack.config.js
module.exports = {
  optimization: {
    usedExports: true,
    innerGraph: true,  // Webpack 5 新增
    minimize: true,
  },
};
```

```javascript
// 更智慧的 Tree Shaking
// utils.js
export function used() { return 'used'; }
export function unused() { return 'unused'; }
export function inner() { return 'inner'; }

// app.js
import { used } from './utils';
// unused() 和 inner() 會被 tree shake 掉

// Webpack 5 的 innerGraph 還能分析：
// 如果 inner() 只在 unused() 內部被呼叫
// 那 unused() 被移除後，inner() 也會一起被移除
```

## 遷移實戰

```bash
# 升級步驟
npm install webpack@5 webpack-cli@4 -D
npm install webpack-dev-server@latest -D
npm install html-webpack-plugin@5 -D

# 移除已內建的 loader
npm uninstall file-loader url-loader raw-loader

# 可能需要更新的 loader
npm install css-loader@latest style-loader@latest -D
npm install mini-css-extract-plugin@latest -D
```

```javascript
// 常見報錯和解決方案

// 1. Buffer is not defined
resolve: {
  fallback: {
    buffer: require.resolve('buffer/'),
  },
}
// 並安裝 npm install buffer

// 2. process is not defined
resolve: {
  fallback: {
    process: require.resolve('process/browser'),
  },
}
// 並安裝 npm install process

// 3. 自定義 Node.js polyfill 方案
const webpack = require('webpack');
plugins: [
  new webpack.ProvidePlugin({
    process: 'process/browser',
    Buffer: ['buffer', 'Buffer'],
  }),
]
```

## 效能對比

```markdown
| 專案規模 | Webpack 4 | Webpack 5 | 提升 |
|
---------|-----------|-----------|------|
| 小專案首次構建 | 15s | 12s | 20% |
| 小專案二次構建 | 12s | 3s | 75% |
| 大專案首次構建 | 90s | 65s | 28% |
| 大專案二次構建 | 75s | 12s | 84% |
| 產物體積 | 1.2MB | 1.0MB | 17% |
```

## 小結

- 持久化快取是升級的最大動力，二次構建速度提升顯著
- Asset Modules 簡化了資源處理配置，可以移除 file/url-loader
- Module Federation 是微前端的官方方案，值得深入研究
- 移除了自動 polyfill，需要手動配置，增加了心智負擔
- 建議在新專案中使用，老專案評估遷移成本後再決定
