---
title: "2020 Frontend Build Tool Roundup: webpack vs Rollup vs esbuild vs Vite"
date: 2020-12-26 15:43:36
tags:
  - Node.js
readingTime: 2
description: "2020 shook up frontend build tooling: webpack 5 shipped, esbuild grabbed attention with its Go-powered bundling speed, and Vite introduced a fresh no-bundle dev server. It's time to systematically compare where each of the four tools fits."
wordCount: 340
---

The frontend build-tooling space changed quite a bit in 2020: webpack 5 went stable, esbuild drew attention with its Go-based blazing-fast bundling, and Vite introduced a brand-new no-bundle dev server approach. It's time to lay out what each of these four tools is for and where they fit.

## Core Positioning Comparison

| Tool      | Positioning       | Underlying language    | Key strength                          |
| --------- | ----------------- | ---------------------- | ------------------------------------- |
| webpack 5 | App bundler       | JavaScript             | Mature ecosystem, full-featured      |
| Rollup    | Library bundler   | JavaScript             | Best-in-class tree-shaking, clean output |
| esbuild   | Ultra-fast transform/bundler | Go           | 10–100x faster                        |
| Vite      | Next-gen dev server | JS + Rollup + esbuild | Extremely fast dev, Rollup for production |

## webpack 5: Mature Application Bundler

**webpack 5 was officially released in October 2020**, with these core improvements:

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

**Best for**: large, complex apps; micro-frontends that need Module Federation; projects already on the webpack ecosystem.

## Rollup: The Go-To for Library Bundling

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

Rollup's tree-shaking is the industry benchmark, and its output is clean and tidy — ideal for publishing npm packages. Vue 3 and React themselves are bundled with Rollup.

**Best for**: component libraries, utility libraries, anything you publish to npm.

## esbuild: The Speed Monster

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

Speed comparison (for a mid-sized project with 1,000 modules):

| Tool      | Cold build time |
| --------- | --------------- |
| webpack 5 | ~8s             |
| Rollup    | ~4s             |
| esbuild   | ~0.3s           |

But esbuild doesn't yet support code splitting, CSS modules, and the like, and its ecosystem isn't complete — so it fits best as the engine underneath other tools (Vite uses it to pre-bundle dependencies).

**Best for**: as the engine under other tools (Vite, Parcel), ultra-fast TS-to-JS, fast CI builds.

## Vite: A Development Experience Revolution

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

Vite's essence is this: **esbuild pre-processing + native ESM in development, Rollup for the production build**.

**Best for**: dev servers for new projects, the official Vue 3 + Vite pairing, anyone chasing the fastest possible dev startup.

## Tool Selection Recommendations

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

## Summary

The shifts in the build-tool landscape in 2020 point to one trend: **developer experience and build speed are becoming core competitive edges**. esbuild's speed and Vite's philosophy have already reshaped the ecosystem — webpack 5's persistent cache and the arrival of SWC are both responses to that same trend.
