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
description: "esbuild is a JavaScript/TypeScript bundler Evan Wallace released in 2020, written in Go. It's not just the fastest JS bundler — it's unbelievably fast, around 100x faster than Webpack and similarly ahead of Parcel and Rollup."
wordCount: 421
---

esbuild is a JavaScript/TypeScript bundler released by Evan Wallace in 2020, written in Go. It isn't just fast — it's unrealistically fast: roughly 100× faster than Webpack, 100× faster than Parcel, and several times faster than Rollup. Vite uses it for dependency pre-bundling, and Snowpack has integrated it as well.

## Why It's So Fast

esbuild's speed comes down to three factors:

1. **Go**: As a compiled language, it's inherently faster than JS. Go's concurrency model (goroutines) also makes parallel processing more efficient.
2. **Built from scratch**: Instead of relying on existing JS libraries (such as acorn or babel), it implements both the parser and the bundler itself.
3. **Memory optimization**: Its data structures are kept compact, reducing memory allocation and GC pressure.

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

## API Usage

esbuild offers both a CLI and an API, and the API is the more flexible option:

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

## Watch Mode

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

Vite uses esbuild in two key places:

1. **Dependency pre-bundling**: During development, it converts CommonJS dependencies to ESM and merges many internal modules into a single file.
2. **Production build minification**: Vite 2.7+ can use esbuild for minification, which is much faster than Terser.

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

esbuild isn't a silver bullet; it has a few notable limitations:

1. **No code splitting in the IIFE format**: The ESM format supports `splitting`, but legacy formats do not.
2. **No decorator transpilation**: Angular projects can't use it directly.
3. **No HMR**: It doesn't implement HMR itself; an upper-layer framework has to handle that.
4. **Small plugin ecosystem**: Webpack plugins can't be migrated over directly.
5. **Limited CSS handling**: It lacks advanced features such as CSS Modules and PostCSS.

```javascript
// ❌ 不支持装饰器
@Component({ template: '<div/>' })
class MyComponent { }

// ❌ 不支持 CSS Modules（需要自行处理）
import styles from './app.module.css'
```

## Positioning Differences from Webpack

esbuild isn't a Webpack replacement — at least not yet. Its role is closer to:

- **Build accelerator**: Replacing the slowest steps in an existing toolchain (compiling TS, bundling, minifying).
- **Prototyping tool**: Bundling small projects and libraries with minimal configuration.
- **Low-level infrastructure**: The underlying engine for tools like Vite and Snowpack.

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

- esbuild is written in Go and runs roughly 100× faster than traditional tools — this isn't marketing spin, it's measured data.
- It works well as a low-level accelerator (Vite and Snowpack already integrate it), but it isn't suited to fully replacing Webpack.
- Webpack users can adopt it incrementally via esbuild-loader to speed things up.
- Its plugin ecosystem, CSS handling, and HMR are still immature — keep an eye on it, but don't blindly switch everything over.
- It points to a broader trend: the frontend toolchain is shifting away from JS toward compiled languages.
