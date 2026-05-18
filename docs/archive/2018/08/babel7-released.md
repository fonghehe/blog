---
title: "Babel 7 正式发布：升级指南与新特性"
date: 2018-08-02 16:20:40
tags:
  - Babel
  - 工程化
readingTime: 2
description: "Babel 7 在 8 月正式发布（经历了超长的 beta 阶段）。升级了几个项目，整理一下主要变化和踩到的坑。"
---

Babel 7 在 8 月正式发布（经历了超长的 beta 阶段）。升级了几个项目，整理一下主要变化和踩到的坑。

## 主要变化

### 1. 包名改变：从 `babel-*` 到 `@babel/*`

这是最大的破坏性改变：

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

### 2. 废弃年度 preset

Babel 6 时有 `babel-preset-es2015`、`babel-preset-es2016` 等，Babel 7 统一用 `@babel/preset-env`：

```bash
npm uninstall babel-preset-es2015 babel-preset-es2016
npm install @babel/preset-env
```

### 3. 配置文件格式

支持新的 `babel.config.js`（项目级别），更灵活：

```javascript
// babel.config.js（新的推荐方式）
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

## 升级步骤

### 步骤 1：更新依赖

```bash
# 删除旧依赖
npm uninstall babel-core babel-preset-env babel-loader
npm uninstall babel-plugin-transform-runtime

# 安装新依赖
npm install --save-dev @babel/core @babel/preset-env
npm install --save-dev @babel/plugin-transform-runtime
npm install @babel/runtime  # 运行时依赖（不是 devDependencies）

# 更新 babel-loader（兼容 Babel 7）
npm install --save-dev babel-loader@8
```

### 步骤 2：更新配置文件

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

### 步骤 3：处理 TypeScript（如果有）

```bash
npm install --save-dev @babel/preset-typescript
```

```javascript
// babel.config.js
presets: ["@babel/preset-env", "@babel/preset-typescript"];
```

## 新特性：可选链和空值合并

这两个提案在 Babel 7 的 beta 阶段就可以用了：

```javascript
// 可选链 (?.)：访问深层属性不再需要判断
// 之前
const city = user && user.address && user.address.city;

// Babel 7 之后
const city = user?.address?.city;

// 函数调用
callback?.();
arr?.[0];

// 空值合并 (??)：区别于 ||（只处理 null/undefined，不处理 0 和 ''）
const count = response.count ?? 0;
// response.count = 0 → 0（不会被 ?? 替换）
// response.count = null → 0（会被 ?? 替换）

// 和 || 的区别
const name = user.name || "匿名"; // '' 也会被替换
const name = user.name ?? "匿名"; // 只有 null/undefined 才替换
```

## useBuiltIns：更智能的 polyfill

```javascript
// useBuiltIns: 'usage' 按需引入
// 不需要手动 import 'core-js'
// Babel 会分析代码里用了哪些新特性，自动引入相应 polyfill

// 例如：代码里用了 Array.from
const arr = Array.from(set);
// Babel 会自动在文件头部添加：
// import 'core-js/modules/es.array.from'
```

## 踩坑记录

**坑 1：`core-js` 版本**

```bash
# babel 7.4+ 需要 core-js 3，需要显式安装
npm install core-js@3
```

```javascript
// 配置里指定版本
["@babel/preset-env", { useBuiltIns: "usage", corejs: 3 }];
```

**坑 2：`babel-upgrade` 工具**

官方提供了升级工具，可以自动处理依赖名称变更：

```bash
npx babel-upgrade --write
```

但不是所有配置都能自动处理，跑完后还需要手动检查。

**坑 3：webpack 的 `babel-loader` 版本**

babel-loader 7 不兼容 Babel 7，需要升级到 babel-loader 8：

```bash
npm install --save-dev babel-loader@8
```

## 小结

- Babel 7 包名全面迁移到 `@babel/*` 命名空间
- `babel.config.js` 是新的推荐配置方式
- `useBuiltIns: 'usage'` 自动按需引入 polyfill
- 可选链 `?.` 和空值合并 `??` 非常实用
- 升级前先用 `babel-upgrade` 工具自动处理依赖名
