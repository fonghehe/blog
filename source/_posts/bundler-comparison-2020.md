---
title: "2020 年前端构建工具横评：webpack vs Rollup vs esbuild vs Vite"
date: 2020-12-26 15:43:36
tags:
  - Node.js
---

2020 年前端构建工具领域发生了不小的变化：webpack 5 正式发布，esbuild 凭借 Go 语言实现的极速打包引发关注，Vite 带来了全新的 No-bundle 开发服务器方案。是时候系统地梳理这四个工具的定位和适用场景了。

## 核心定位对比

| 工具      | 定位             | 底层语言              | 主要优势                    |
| --------- | ---------------- | --------------------- | --------------------------- |
| webpack 5 | 应用打包         | JavaScript            | 生态成熟、功能完整          |
| Rollup    | 库打包           | JavaScript            | Tree-shaking 极佳、输出干净 |
| esbuild   | 极速转换/打包    | Go                    | 速度领先 10-100x            |
| Vite      | 下一代开发服务器 | JS + Rollup + esbuild | 开发极速，生产用 Rollup     |

## webpack 5：成熟的应用打包器

**2020 年 10 月正式发布 webpack 5**，核心改进：

```javascript
// webpack.config.js
module.exports = {
  // 1. 持久化缓存（增量构建）
  cache: {
    type: "filesystem", // 缓存到磁盘
    buildDependencies: {
      config: [__filename], // 配置变更时缓存失效
    },
  },

  // 2. Module Federation（微前端）
  plugins: [
    new ModuleFederationPlugin({
      name: "app1",
      exposes: {
        "./Button": "./src/Button", // 暴露组件给其他应用
      },
    }),
  ],

  // 3. Asset Modules（替代 file-loader/url-loader）
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        type: "asset/resource", // 替代 file-loader
      },
    ],
  },
};
```

**适用场景**：大型复杂应用、需要 Module Federation 的微前端、已有 webpack 生态的项目。

## Rollup：库打包的首选

```javascript
// rollup.config.js
export default {
  input: "src/index.ts",
  output: [
    { file: "dist/index.cjs.js", format: "cjs" }, // Node.js
    { file: "dist/index.esm.js", format: "esm" }, // ES Module
    { file: "dist/index.umd.js", format: "umd", name: "MyLib" }, // 浏览器
  ],
  plugins: [typescript(), resolve(), commonjs()],
  external: ["react", "lodash"], // peer dependencies 不打包进去
};
```

Rollup 的 tree-shaking 是业界标杆，生成的代码干净简洁，适合发布 npm 包。Vue 3、React 本身都用 Rollup 打包。

**适用场景**：组件库、工具函数库、任何要发布到 npm 的包。

## esbuild：速度怪兽

```javascript
// 用 esbuild API 打包
const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    outfile: "dist/bundle.js",
    platform: "browser",
    target: ["chrome80", "firefox78"],
  })
  .catch(() => process.exit(1));
```

速度对比（对一个中型项目，含 1000 个模块）：

| 工具      | 冷构建时间 |
| --------- | ---------- |
| webpack 5 | ~8s        |
| Rollup    | ~4s        |
| esbuild   | ~0.3s      |

但 esbuild 目前不支持代码分割（code splitting）、不支持 CSS modules 等特性，生态不够完整，适合作为其他工具的底层（Vite 用它预构建依赖）。

**适用场景**：作为其他工具的底层（Vite、Parcel）、需要极速 TS 转 JS、CI 中的快速构建。

## Vite：开发体验革命

```javascript
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // 生产构建仍用 Rollup
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
});
```

Vite 的本质是：**开发时用 esbuild 预处理 + 原生 ESM，生产时用 Rollup 打包**。

**适用场景**：新项目的开发服务器、Vue 3 + Vite 官方搭配、追求极速开发启动。

## 选型建议

```
新的应用项目？
  ├── 追求开发速度 → Vite（开发），Rollup（生产）
  └── 需要 IE 兼容 / 复杂微前端 → webpack 5

开发 npm 库？
  └── Rollup（首选）

构建工具的底层处理器？
  └── esbuild（速度优先）

已有 webpack 项目？
  └── 升级 webpack 5（开启持久化缓存可减少 60% 构建时间）
```

## 总结

2020 年构建工具的格局变化预示着一个趋势：**开发体验和构建速度将成为核心竞争力**。esbuild 的速度和 Vite 的理念已经影响了整个生态——webpack 5 的持久化缓存、SWC 的出现，都是对这一趋势的响应。
