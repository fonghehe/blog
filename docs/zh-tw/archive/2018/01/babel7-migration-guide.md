---
title: "Babel 7 升級遷移實戰"
date: 2018-01-27 15:13:59
tags:
  - Babel
  - 工程化
readingTime: 3
description: "Babel 7 beta 已經發布相當長時間，從 6 升到 7 有不少破壞性變更，但也帶來了一些實用的新特性。這篇文章記錄實際專案升級的過程和踩過的坑。"
---

Babel 7 beta 已經發布相當長時間，從 6 升到 7 有不少破壞性變更，但也帶來了一些實用的新特性。這篇文章記錄實際專案升級的過程和踩過的坑。

## Babel 7 的主要變化

### 1. 套件名改為 scoped

這是最直觀的變化，所有官方套件都移到 `@babel/` 命名空間下：

```bash
# Babel 6
babel-core
babel-cli
babel-preset-env
babel-preset-react
babel-plugin-transform-async-to-generator

# Babel 7
@babel/core
@babel/cli
@babel/preset-env
@babel/preset-react
@babel/plugin-transform-async-generator-functions
```

### 2. `babel-preset-env` 的改進

Babel 7 的 `@babel/preset-env` 支援更細粒度的設定：

```json
// .babelrc（Babel 6）
{
  "presets": [
    ["env", {
      "targets": { "browsers": ["> 1%"] },
      "useBuiltIns": true
    }]
  ]
}

// babel.config.js（Babel 7 推薦格式）
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: { browsers: ["> 1%", "last 2 versions"] },
      useBuiltIns: 'usage',  // 按需引入 polyfill（新）
      corejs: 3,             // 指定 core-js 版本（新）
      modules: false         // 保留 ES Module，讓 Webpack 做 Tree Shaking
    }]
  ]
}
```

`useBuiltIns: 'usage'` 是很有價值的改進：它會分析程式碼裡實際使用了哪些 ES6+ 特性，只引入對應的 polyfill，而不是全量引入 `@babel/polyfill`。

### 3. 專案級設定檔：babel.config.js

Babel 6 的 `.babelrc` 只影響當前目錄和子目錄，在 monorepo 專案裡很麻煩。Babel 7 引入了 `babel.config.js`，放在專案根目錄，對整個專案生效：

```javascript
// babel.config.js（專案根目錄）
module.exports = function (api) {
  // 快取設定，避免每次都重新計算
  api.cache(true);

  const presets = [
    [
      "@babel/preset-env",
      {
        targets: { node: "current" }, // 測試環境
        modules: "commonjs",
      },
    ],
  ];

  const plugins = [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
  ];

  return { presets, plugins };
};
```

## 升級步驟

### 第一步：更新依賴

```bash
# 移除舊套件
npm uninstall babel-core babel-cli babel-preset-env babel-preset-react \
  babel-plugin-transform-class-properties babel-plugin-transform-object-rest-spread

# 安裝新套件
npm install --save-dev @babel/core @babel/cli @babel/preset-env @babel/preset-react \
  @babel/plugin-proposal-class-properties @babel/plugin-proposal-object-rest-spread

# 安裝 polyfill 相關
npm install @babel/polyfill core-js@3
```

### 第二步：更新 .babelrc 或改用 babel.config.js

```javascript
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "usage",
        corejs: 3,
        modules: false,
      },
    ],
    "@babel/preset-react",
  ],
  plugins: [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
  ],
  env: {
    test: {
      presets: [["@babel/preset-env", { targets: { node: "current" } }]],
    },
  },
};
```

### 第三步：處理 `babel-register` 和 `babel-node`

如果在 Node.js 腳本裡用到了 `require('babel-register')`：

```javascript
// 之前
require("babel-register");

// 之後
require("@babel/register");
```

### 第四步：處理與 Webpack 的整合

```bash
npm install --save-dev babel-loader  # babel-loader 8.x 相容 Babel 7
```

```javascript
// webpack.config.js
module: {
  rules: [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          cacheDirectory: true, // 開啟快取，加快二次建置
        },
      },
    },
  ];
}
```

## 常見踩坑

**坑一：`@babel/polyfill` 已廢棄**

Babel 7.4 開始，`@babel/polyfill` 被標記為廢棄，改為直接引入：

```javascript
// 之前
import "@babel/polyfill";

// 之後（配合 useBuiltIns: 'usage' 不需要手動 import）
// 或者手動引入
import "core-js/stable";
import "regenerator-runtime/runtime";
```

**坑二：class 屬性語法的設定**

```javascript
class MyComponent extends React.Component {
  state = { count: 0 }; // class fields（stage-3）
  handleClick = () => {}; // 箭頭函式屬性
}
```

這需要 `@babel/plugin-proposal-class-properties`，注意 `loose` 模式的區別：

```json
// loose: true 產生更簡潔的程式碼，但與規範行為有細微差異
// loose: false（預設）更符合規範
["@babel/plugin-proposal-class-properties", { "loose": false }]
```

**坑三：與 TypeScript 專案的整合**

```bash
npm install --save-dev @babel/preset-typescript
```

```javascript
// babel.config.js
presets: ["@babel/preset-typescript", "@babel/preset-env"];
```

注意：Babel 處理 TypeScript 只做語法轉換，不做型別檢查。型別檢查還是要單獨跑 `tsc --noEmit`。

## 升級後的收益

在我們的專案上，升級 Babel 7 配合 `useBuiltIns: 'usage'` 後：

- `polyfill` 體積從 86KB（gzip）降到 18KB（只引入了實際用到的）
- 冷啟動建置速度提升約 15%（Babel 7 內部最佳化）

---

_下一篇：ESLint + Prettier 工程化規範設定_
