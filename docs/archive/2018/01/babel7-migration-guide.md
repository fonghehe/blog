---
title: "Babel 7 升级迁移实战"
date: 2018-01-27 15:13:59
tags:
  - Babel
  - 工程化
---

Babel 7 beta 已经发布了相当长时间，从 6 升到 7 有不少破坏性变更，但也带来了一些实用的新特性。这篇文章记录实际项目升级的过程和踩过的坑。

## Babel 7 的主要变化

### 1. 包名改为 scoped

这是最直观的变化，所有官方包都移到 `@babel/` 命名空间下：

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

### 2. `babel-preset-env` 的改进

Babel 7 的 `@babel/preset-env` 支持更细粒度的配置：

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

// babel.config.js（Babel 7 推荐格式）
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: { browsers: ["> 1%", "last 2 versions"] },
      useBuiltIns: 'usage',  // 按需引入 polyfill（新）
      corejs: 3,             // 指定 core-js 版本（新）
      modules: false         // 保留 ES Module，让 Webpack 做 Tree Shaking
    }]
  ]
}
```

`useBuiltIns: 'usage'` 是很有价值的改进：它会分析代码里实际使用了哪些 ES6+ 特性，只引入对应的 polyfill，而不是全量引入 `@babel/polyfill`。

### 3. 项目级配置文件：babel.config.js

Babel 6 的 `.babelrc` 只影响当前目录和子目录，在 monorepo 项目里很麻烦。Babel 7 引入了 `babel.config.js`，放在项目根目录，对整个项目生效：

```javascript
// babel.config.js（项目根目录）
module.exports = function (api) {
  // 缓存配置，避免每次都重新计算
  api.cache(true);

  const presets = [
    [
      "@babel/preset-env",
      {
        targets: { node: "current" }, // 测试环境
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

## 升级步骤

### 第一步：更新依赖

```bash
# 卸载旧包
npm uninstall babel-core babel-cli babel-preset-env babel-preset-react \
  babel-plugin-transform-class-properties babel-plugin-transform-object-rest-spread

# 安装新包
npm install --save-dev @babel/core @babel/cli @babel/preset-env @babel/preset-react \
  @babel/plugin-proposal-class-properties @babel/plugin-proposal-object-rest-spread

# 安装 polyfill 相关
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

### 第三步：处理 `babel-register` 和 `babel-node`

如果在 Node.js 脚本里用到了 `require('babel-register')`：

```javascript
// 之前
require("babel-register");

// 之后
require("@babel/register");
```

### 第四步：处理与 Webpack 的集成

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
          cacheDirectory: true, // 开启缓存，加快二次构建
        },
      },
    },
  ];
}
```

## 常见踩坑

**坑一：`@babel/polyfill` 已废弃**

Babel 7.4 开始，`@babel/polyfill` 被标记为废弃，改为直接引入：

```javascript
// 之前
import "@babel/polyfill";

// 之后（配合 useBuiltIns: 'usage' 不需要手动 import）
// 或者手动引入
import "core-js/stable";
import "regenerator-runtime/runtime";
```

**坑二：class 属性语法的配置**

```javascript
class MyComponent extends React.Component {
  state = { count: 0 }; // class fields（stage-3）
  handleClick = () => {}; // 箭头函数属性
}
```

这需要 `@babel/plugin-proposal-class-properties`，注意 `loose` 模式的区别：

```json
// loose: true 生成更简洁的代码，但与规范行为有细微差异
// loose: false（默认）更符合规范
["@babel/plugin-proposal-class-properties", { "loose": false }]
```

**坑三：与 TypeScript 项目的集成**

```bash
npm install --save-dev @babel/preset-typescript
```

```javascript
// babel.config.js
presets: ["@babel/preset-typescript", "@babel/preset-env"];
```

注意：Babel 处理 TypeScript 只做语法转换，不做类型检查。类型检查还是要单独跑 `tsc --noEmit`。

## 升级后的收益

在我们的项目上，升级 Babel 7 配合 `useBuiltIns: 'usage'` 后：

- `polyfill` 体积从 86KB（gzip）降到 18KB（只引入了实际用到的）
- 冷启动构建速度提升约 15%（Babel 7 内部优化）

---

_下一篇：ESLint + Prettier 工程化规范配置_
