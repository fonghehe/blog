---
title: "Babel 7 正式發佈：升級指南與新特性"
date: 2018-08-02 16:20:40
tags:
  - Babel
  - 工程化
readingTime: 2
description: "Babel 7 在 8 月正式發佈（經歷了超長的 beta 階段）。升級了幾個項目，整理一下主要變化和踩到的坑。"
wordCount: 309
---

Babel 7 在 8 月正式發佈（經歷了超長的 beta 階段）。升級了幾個項目，整理一下主要變化和踩到的坑。

## 主要變化

### 1. 包名改變：從 `babel-*` 到 `@babel/*`

這是最大的破壞性改變：

```bash
# Babel 6
babel-core
babel-preset-env
babel-preset-react
babel-plugin-transform-runtime

# Babel 7
@babel/core
@babel/preset-env
@babel/preset-react
@babel/plugin-transform-runtime
```

### 2. 廢棄年度 preset

Babel 6 時有 `babel-preset-es2015`、`babel-preset-es2016` 等，Babel 7 統一用 `@babel/preset-env`：

```bash
npm uninstall babel-preset-es2015 babel-preset-es2016
npm install @babel/preset-env
```

### 3. 設定檔案格式

支持新的 `babel.config.js`（項目級別），更靈活：

```javascript
// babel.config.js（新的推薦方式）
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          browsers: ["> 1%", "last 2 versions", "not ie <= 8"],
        },
        useBuiltIns: "usage", // 按需引入 polyfill
        corejs: 3, // 指定 core-js 版本
      },
    ],
  ],
  plugins: [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-proposal-optional-chaining", // ?. 操作符
    "@babel/plugin-proposal-nullish-coalescing-operator", // ?? 操作符
  ],
};
```

## 升級步驟

### 步驟 1：更新依賴

```bash
# 刪除舊依賴
npm uninstall babel-core babel-preset-env babel-loader
npm uninstall babel-plugin-transform-runtime

# 安裝新依賴
npm install --save-dev @babel/core @babel/preset-env
npm install --save-dev @babel/plugin-transform-runtime
npm install @babel/runtime  # 運行時依賴（不是 devDependencies）

# 更新 babel-loader（相容 Babel 7）
npm install --save-dev babel-loader@8
```

### 步驟 2：更新設定檔案

```javascript
// .babelrc（或 babel.config.js）
{
  "presets": [
    ["@babel/preset-env", {
      "targets": { "browsers": ["> 1%", "last 2 versions"] },
      "useBuiltIns": "usage",
      "corejs": 3
    }]
  ]
}
```

### 步驟 3：處理 TypeScript（如果有）

```bash
npm install --save-dev @babel/preset-typescript
```

```javascript
// babel.config.js
presets: ["@babel/preset-env", "@babel/preset-typescript"];
```

## 新特性：可選鏈和空值合併

這兩個提案在 Babel 7 的 beta 階段就可以用了：

```javascript
// 可選鏈 (?.)：訪問深層屬性不再需要判斷
// 之前
const city = user && user.address && user.address.city;

// Babel 7 之後
const city = user?.address?.city;

// 函數調用
callback?.();
arr?.[0];

// 空值合併 (??)：區別於 ||（隻處理 null/undefined，不處理 0 和 ''）
const count = response.count ?? 0;
// response.count = 0 → 0（不會被 ?? 替換）
// response.count = null → 0（會被 ?? 替換）

// 和 || 的區別
const name = user.name || "匿名"; // '' 也會被替換
const name = user.name ?? "匿名"; // 隻有 null/undefined 才替換
```

## useBuiltIns：更智能的 polyfill

```javascript
// useBuiltIns: 'usage' 按需引入
// 不需要手動 import 'core-js'
// Babel 會分析代碼裏用了哪些新特性，自動引入相應 polyfill

// 例如：代碼裏用了 Array.from
const arr = Array.from(set);
// Babel 會自動在文件頭部添加：
// import 'core-js/modules/es.array.from'
```

## 踩坑記錄

**坑 1：`core-js` 版本**

```bash
# babel 7.4+ 需要 core-js 3，需要顯式安裝
npm install core-js@3
```

```javascript
// 配置裏指定版本
["@babel/preset-env", { useBuiltIns: "usage", corejs: 3 }];
```

**坑 2：`babel-upgrade` 工具**

官方提供了升級工具，可以自動處理依賴名稱變更：

```bash
npx babel-upgrade --write
```

但不是所有設定都能自動處理，跑完後還需要手動檢查。

**坑 3：webpack 的 `babel-loader` 版本**

babel-loader 7 不相容 Babel 7，需要升級到 babel-loader 8：

```bash
npm install --save-dev babel-loader@8
```

## 小結

- Babel 7 包名全面遷移到 `@babel/*` 命名空間
- `babel.config.js` 是新的推薦配置方式
- `useBuiltIns: 'usage'` 自動按需引入 polyfill
- 可選鏈 `?.` 和空值合併 `??` 非常實用
- 升級前先用 `babel-upgrade` 工具自動處理依賴名
