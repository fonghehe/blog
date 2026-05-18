---
title: "前端构建性能优化：从 Webpack 到 Vite"
date: 2021-09-20 11:47:17
tags:
  - 性能优化
  - 工程化
readingTime: 3
description: "最近几个项目陆续从 Webpack 迁移到了 Vite，构建速度的差距比想象中大。这篇整理一下构建性能优化的思路，从 Webpack 调优到直接换 Vite 的决策过程。"
---

最近几个项目陆续从 Webpack 迁移到了 Vite，构建速度的差距比想象中大。这篇整理一下构建性能优化的思路，从 Webpack 调优到直接换 Vite 的决策过程。

## Webpack 的瓶颈在哪

Webpack 之所以慢，核心原因：**一切皆模块，模块必须先打包再启动**。

```
启动 dev server：
1. 分析入口文件
2. 递归解析所有 import → 构建完整依赖图
3. 编译所有模块（Babel + Loader 链）
4. 生成 bundle
5. 启动服务器

项目大了之后，步骤 2-4 可能要 30s-2min
```

## Webpack 调优（还能榨出多少性能）

### 1. 缩小搜索范围

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

### 2. 缓存

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

### 3. 多线程

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

### 4. DLL（老方案，Webpack 5 不需要了）

```javascript
// Webpack 4 时代的方案：预打包不变的依赖
// Webpack 5 用 cache.type: 'filesystem' 替代
```

### Webpack 调优的天花板

实测一个中型项目（200+ 模块）：

| 优化项 | 时间 |
|--------|------|
| 无优化 | 45s |
| ts-loader transpileOnly | 28s |
| filesystem cache（二次启动） | 8s |
| thread-loader | 22s |
| 全部优化 | 6s（二次启动） |

二次启动 6s 已经是 Webpack 的极限了，首次启动还是要 20s+。

## Vite：换个思路

Vite 的核心想法：**开发环境不打包，生产环境用 Rollup**。

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

## Vite 为什么快

```typescript
// 浏览器请求 /src/main.ts
// Vite 返回：

// import { createApp } from 'vue'
// ↓ 转换为
import { createApp } from '/node_modules/.vite/deps/vue.js?v=abc123'

// 每个依赖都预构建好了（esbuild），每个文件单独编译
// 只有你访问到的模块才会被编译
```

- 依赖预构建：esbuild（Go 语言写的，比 JS 快 10-100 倍）
- 源码按需编译：ESM + 浏览器原生导入
- HMR：只编译修改的文件，和依赖图大小无关

## 性能对比实测

同一个项目（Vue 3 + TypeScript，200+ 组件）：

| 指标 | Webpack 5（优化后） | Vite 2.x |
|------|---------------------|----------|
| 首次启动 | 22s | 0.8s |
| 二次启动（缓存） | 6s | 0.3s |
| HMR | 2-5s | < 100ms |
| 生产构建 | 45s | 30s |
| 包体积（gzip） | 186KB | 178KB |

生产构建差距不大（Vite 用 Rollup，Rollup 的 tree-shaking 更好），开发体验差距巨大。

## 迁移注意事项

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

## 哪些项目不适合迁移

- 高度依赖 Webpack 插件生态的（Module Federation、特殊 loader）
- 遗留的 CommonJS 项目（Vite 开发环境用 ESM）
- 需要兼容 IE11 的项目（Vite 不支持）

## 小结

- Webpack 调优能从 45s 降到 6s，但有天花板
- Vite 从根本上改变了开发体验：按需编译 + esbuild 预构建
- 新项目直接用 Vite，老项目评估 Webpack 插件依赖后决定是否迁移
- 生产构建两者差距不大，Vite 的 Rollup tree-shaking 略有优势
- 2021 年，Vite 已经是 Vue 3 项目的事实标准