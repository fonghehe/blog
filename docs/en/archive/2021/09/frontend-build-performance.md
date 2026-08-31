---
title: "Frontend Build Performance Optimization: From Webpack to Vite"
date: 2021-09-20 11:47:17
tags:
  - Engineering
  - Webpack
  - Vite
  - Performance

readingTime: 3
description: "Recently several projects migrated from Webpack to Vite, and the gap in build speed was bigger than I expected. This post walks through my thinking on build-performance optimization—from tuning Webpack all the way to the decision to switch to Vite."
wordCount: 358
---

Recently several projects migrated from Webpack to Vite, and the gap in build speed was bigger than I expected. This post walks through my thinking on build-performance optimization—from tuning Webpack all the way to the decision to switch to Vite.

## Where Webpack Bottlenecks

Why Webpack is slow comes down to one core reason: everything is a module, and modules must be bundled before the dev server can start.

```
启动 dev server：
1. 分析入口文件
2. 递归解析所有 import → 构建完整依赖图
3. 编译所有模块（Babel + Loader 链）
4. 生成 bundle
5. 启动服务器

项目大了之后，步骤 2-4 可能要 30s-2min
```

## Webpack Tuning (How Much More Performance Can We Get)

### 1. Narrow the Search Scope

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: path.resolve(__dirname, 'src'), // 只处理 src
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // 少写后缀，但别列太多
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // 不需要解析 symlink
    symlinks: false,
  },
}
```

### 2. Caching

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              // 开启持久缓存（Webpack 5 内置）
              // ts-loader + transpileOnly 大幅提速
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  // Webpack 5 持久缓存
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
}
```

### 3. Multithreading

```javascript
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true, // 多线程压缩
      }),
    ],
  },
  // 或者用 thread-loader
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          'thread-loader', // 把后续 loader 放到 worker 池
          'ts-loader',
        ],
      },
    ],
  },
}
```

### 4. DLL (Legacy approach, no longer needed in Webpack 5)

```javascript
// Webpack 4 时代的方案：预打包不变的依赖
// Webpack 5 用 cache.type: 'filesystem' 替代
```

### The Ceiling of Webpack Tuning

Measured on a medium-sized project (200+ modules):

| Optimization | Time |
|--------|------|
| No optimization | 45s |
| ts-loader transpileOnly | 28s |
| filesystem cache (warm restart) | 8s |
| thread-loader | 22s |
| All optimizations combined | 6s (warm restart) |

Six seconds on a warm restart is already Webpack's ceiling; the first cold start still takes 20s+.

## Vite: A Different Approach

Vite's core idea: no bundling in development, Rollup for production.

```
启动 dev server：
1. 启动服务器（几乎瞬时）
3. 浏览器请求 → 按需编译单个文件
4. 返回结果

启动时间：< 1s
```

```bash
npm create vite@latest my-app -- --template vue-ts
cd my-app
npm install
npm run dev   # < 1s 启动
```

## Why Vite Is Fast

```typescript
// 浏览器请求 /src/main.ts
// Vite 返回：

// import { createApp } from 'vue'
// ↓ 转换为
import { createApp } from '/node_modules/.vite/deps/vue.js?v=abc123'

// 每个依赖都预构建好了（esbuild），每个文件单独编译
// 只有你访问到的模块才会被编译
```

- Dependency pre-bundling: esbuild (written in Go, 10–100x faster than JS)
- On-demand source compilation: ESM + native browser imports
- HMR: only the changed file is compiled, independent of the dependency graph size

## Performance Benchmark

Same project (Vue 3 + TypeScript, 200+ components):

| Metric | Webpack 5 (optimized) | Vite 2.x |
|------|---------------------|----------|
| First startup | 22s | 0.8s |
| Warm restart (cached) | 6s | 0.3s |
| HMR | 2-5s | < 100ms |
| Production build | 45s | 30s |
| Bundle size (gzip) | 186KB | 178KB |

The production-build gap is small (Vite uses Rollup, whose tree-shaking is better), but the development experience is drastically different.

## Migration Notes

```typescript
// 1. import 必须带后缀（或者配置 resolve.extensions）
import { ref } from 'vue'         // ✅ 第三方包不需要后缀
import { useAuth } from './auth'  // ❌ Vite 默认需要后缀
import { useAuth } from './auth.ts' // ✅

// vite.config.ts 里可以放宽
export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js', '.vue'], // 添加后缀解析
  },
})

// 2. 环境变量
// Webpack: process.env.NODE_ENV
// Vite: import.meta.env.MODE

// 3. 静态资源
// Webpack: require('./logo.png') → url
// Vite: import logo from './logo.png' → url

// 4. CSS Modules
// 两种写法都支持：
import styles from './index.module.css'  // ✅ Vite 推荐
```

## Projects Not Suitable for Migration

- Projects heavily dependent on the Webpack plugin ecosystem (Module Federation, special loaders)
- Legacy CommonJS projects (Vite's dev environment uses ESM)
- Projects that need IE11 support (Vite doesn't support it)

## Summary

- Webpack tuning can bring startup from 45s down to 6s, but there's a ceiling.
- Vite fundamentally changes the dev experience: on-demand compilation plus esbuild pre-bundling.
- Use Vite directly for new projects; for legacy ones, evaluate Webpack plugin dependencies before deciding whether to migrate.
- The production-build difference is small, with Vite's Rollup tree-shaking having a slight edge.
- In 2021, Vite is already the de facto standard for Vue 3 projects.