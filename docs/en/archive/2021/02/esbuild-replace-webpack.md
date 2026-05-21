---
title: "esbuild: A JS Bundler Rewritten in Go"
date: 2021-02-08 09:51:13
tags:
  - React
  - Angular
  - Webpack
  - Vite
  - JavaScript
  - TypeScript
  - CSS
  - Node.js

readingTime: 3
description: "esbuild 是 Evan Wallace 在 2020 年发布的 JavaScript/TypeScript 打包器，用 Go 语言编写。它不是最快的 JS 打包器，它是快到不真实的那种——比 Webpack 快 100 倍，比 Parcel 快 100 倍，比 Rollup 快数倍。Vite 用它做依赖预构建，S"
wordCount: 581
---

esbuild 是 Evan Wallace 在 2020 年发布的 JavaScript/TypeScript 打包器，用 Go 语言编写。它不是最快的 JS 打包器，它是快到不真实的那种——比 Webpack 快 100 倍，比 Parcel 快 100 倍，比 Rollup 快数倍。Vite 用它做依赖预构建，Snowpack 也集成了它。

## Why It's So Fast

esbuild 速度快有三个原因：

1. **Go 语言**：编译型语言，天然比 JS 快。Go 的并发模型（goroutine）也让并行处理更高效
2. **从零实现**：不用任何现有的 JS 库（如 acorn、babel），全部自己实现 parser 和 bundler
3. **内存优化**：数据结构尽量紧凑，减少内存分配和 GC 压力

```bash
# 实际测试：打包 10 个 Three.js 拷贝
# esbuild:  ~47ms
# Webpack:  ~4,250ms
# Rollup:   ~1,780ms
# Parcel:   ~4,500ms
```

## Basic Usage

```bash
# 全局安装
npm install -g esbuild

# 打包单文件
esbuild app.ts --bundle --outfile=out.js

# 打包为生产环境
esbuild app.ts --bundle --minify --outfile=out.js

# 多入口
esbuild src/home.ts src/about.ts --bundle --outdir=dist
```

## API 使用

esbuild 有 CLI 和 API 两种使用方式，API 更灵活：

```javascript
const esbuild = require('esbuild')

// 构建
async function build() {
  const result = await esbuild.build({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    outdir: 'dist',
    format: 'esm',
    splitting: true, // 代码分割（ESM 格式下可用）
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    loader: {
      '.tsx': 'tsx',
      '.css': 'css',
      '.png': 'dataurl',
      '.svg': 'text'
    },
    external: ['react', 'react-dom'], // 不打包这些
    plugins: [
      // 插件示例
      {
        name: 'env-plugin',
        setup(build) {
          build.onResolve({ filter: /^env$/ }, () => ({
            path: 'env',
            namespace: 'env-ns'
          }))
          build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
            contents: JSON.stringify(process.env),
            loader: 'json'
          }))
        }
      }
    ]
  })

  console.log(`构建完成，输出 ${result.outputFiles.length} 个文件`)
}

build()
```

## Watch 模式

```javascript
const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
  sourcemap: true
})

// 监听文件变化
await ctx.watch()

// 启动开发服务器（esbuild 0.17+）
await ctx.serve({
  port: 3000,
  servedir: 'dist'
})
```

## esbuild's Role in Vite

Vite 在两个关键位置使用了 esbuild：

1. **依赖预构建**：开发阶段，将 CommonJS 依赖转为 ESM，将许多内部模块合并为一个文件
2. **生产构建的代码压缩**：Vite 2.7+ 支持用 esbuild 做 minify，比 Terser 快很多

```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    // esbuild 预构建配置
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    // Vite 2.7+ 使用 esbuild 压缩
    minify: 'esbuild', // 'terser' | 'esbuild'
    target: 'es2015'
  }
})
```

## Current Limitations

esbuild 不是万能的，有几个明显限制：

1. **没有代码分割的 IIFE 格式**：ESM 格式支持 `splitting`，但传统格式不支持
2. **不支持转换装饰器语法**：Angular 项目无法直接用
3. **不支持 HMR**：自己不会实现 HMR，需要上层框架处理
4. **插件生态很小**：Webpack 插件不能直接迁移
5. **CSS 处理有限**：不支持 CSS Modules、PostCSS 等高级功能

```javascript
// ❌ 不支持装饰器
@Component({ template: '<div/>' })
class MyComponent { }

// ❌ 不支持 CSS Modules（需要自行处理）
import styles from './app.module.css'
```

## Positioning Differences from Webpack

esbuild 不是 Webpack 的替代品，至少目前不是。它的定位更像是：

- **构建加速器**：在现有工具链中替代最慢的环节（编译 TS、打包、压缩）
- **原型工具**：小型项目和库的打包，配置简单
- **底层基础设施**：Vite、Snowpack 等工具的底层引擎

```javascript
// Webpack 用户的渐进式采用方式
// 1. 用 esbuild-loader 替代 babel-loader + ts-loader
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'tsx',    // tsx 文件用 tsx loader
          target: 'es2015'
        }
      }
    ]
  },
  plugins: [
    // 2. 用 EsbuildPlugin 替代 TerserPlugin 做压缩
    new EsbuildPlugin({
      target: 'es2015',
      css: true
    })
  ]
}
```

## Summary

- esbuild 用 Go 编写，速度比传统工具快 100 倍，不是营销话术是实测数据
- 适合用作底层加速工具（Vite、Snowpack 已集成），不适合完全替代 Webpack
- Webpack 用户可以用 esbuild-loader 做渐进式提速
- 插件生态、CSS 处理、HMR 还不成熟，关注但不要盲目全面切换
- 它代表了一个趋势：前端工具链正在从 JS 迁移到编译型语言
