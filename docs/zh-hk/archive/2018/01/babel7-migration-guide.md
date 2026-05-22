---
title: "Babel 7 升級遷移實戰：落地路徑與實戰建議"
date: 2018-01-27 15:13:59
tags:
  - Babel
  - 工程化
readingTime: 3
description: "Babel 7 beta 已經發布咗相當長時間，從 6 升到 7 有唔少破壞性變更，但都帶嚟咗一啲實用嘅新特性。呢篇文章記錄實際項目升級嘅過程同踩過嘅坑。"
wordCount: 438
---

Babel 7 beta 已經發布咗相當長時間，從 6 升到 7 有唔少破壞性變更，但都帶嚟咗一啲實用嘅新特性。呢篇文章記錄實際項目升級嘅過程同踩過嘅坑。

## Babel 7 嘅主要變化

### 1. 包名改為 scoped

呢個係最直觀嘅變化，所有官方包都移到 `@babel/` 命名空間下：

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

### 2. `babel-preset-env` 嘅改進

Babel 7 嘅 `@babel/preset-env` 支援更細粒度嘅配置：

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

`useBuiltIns: 'usage'` 係好有價值嘅改進：佢會分析代碼裡面實際使用咗邊啲 ES6+ 特性，隻引入對應嘅 polyfill，而唔係全量引入 `@babel/polyfill`。

### 3. 項目級設定檔案：babel.config.js

Babel 6 嘅 `.babelrc` 隻影響當前目錄同子目錄，喺 monorepo 項目裡面好麻煩。Babel 7 引入咗 `babel.config.js`，放喺項目根目錄，對整個項目生效：

```javascript
// babel.config.js（項目根目錄）
module.exports = function (api) {
  // 緩存配置，避免每次都重新計算
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
# 卸載舊包
npm uninstall babel-core babel-cli babel-preset-env babel-preset-react \
  babel-plugin-transform-class-properties babel-plugin-transform-object-rest-spread

# 安裝新包
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

### 第三步：處理 `babel-register` 同 `babel-node`

如果喺 Node.js 腳本裡面用到咗 `require('babel-register')`：

```javascript
// 之前
require("babel-register");

// 之後
require("@babel/register");
```

### 第四步：處理同 Webpack 嘅整合

```bash
npm install --save-dev babel-loader  # babel-loader 8.x 兼容 Babel 7
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
          cacheDirectory: true, // 開啟緩存，加快二次構建
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

// 之後（配合 useBuiltIns: 'usage' 唔需要手動 import）
// 或者手動引入
import "core-js/stable";
import "regenerator-runtime/runtime";
```

**坑二：class 屬性語法嘅配置**

```javascript
class MyComponent extends React.Component {
  state = { count: 0 }; // class fields（stage-3）
  handleClick = () => {}; // 箭頭函數屬性
}
```

呢個需要 `@babel/plugin-proposal-class-properties`，注意 `loose` 模式嘅區別：

```json
// loose: true 生成更簡潔嘅代碼，但同規範行為有細微差異
// loose: false（預設）更符合規範
["@babel/plugin-proposal-class-properties", { "loose": false }]
```

**坑三：同 TypeScript 項目嘅整合**

```bash
npm install --save-dev @babel/preset-typescript
```

```javascript
// babel.config.js
presets: ["@babel/preset-typescript", "@babel/preset-env"];
```

注意：Babel 處理 TypeScript 隻做語法轉換，唔做類型檢查。類型檢查仲係要單獨跑 `tsc --noEmit`。

## 升級後嘅收益

喺我哋嘅項目上，升級 Babel 7 配合 `useBuiltIns: 'usage'` 之後：

- `polyfill` 體積從 86KB（gzip）降到 18KB（隻引入咗實際用到嘅）
- 冷啟動構建速度提升約 15%（Babel 7 內部優化）

---

_下一篇：ESLint + Prettier 工程化規範配置_
