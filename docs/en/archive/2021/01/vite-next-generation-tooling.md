---
title: "Vite 2.0: The True Next-Generation Build Tool"
date: 2021-01-11 11:18:56
tags:
  - Vue
  - React
  - Webpack
  - Vite
  - JavaScript
  - CSS
  - Node.js

readingTime: 3
description: "Evan You released Vite 2.0 in January 2021. Compared with 1.0 it is almost a complete rewrite — the biggest change is that it's framework-agnostic, no longer serving only the Vue ecosystem. As someone who has used frontend tooling since the Webpack 1 era, what Vite gave me wasn't just speed but a full upgrade in developer experience."
wordCount: 487
---

Evan You released Vite 2.0 stable in January 2021. Compared with 1.0, it's almost a complete rewrite — the biggest change is that it's now framework-agnostic and no longer serves only the Vue ecosystem. As a frontend engineer who has used Vite since the webpack 1 era, my takeaway isn't just that it's "fast," but that it's a comprehensive upgrade to the development experience.

## Why Vite Is So Fast

Traditional bundlers (webpack, Rollup) have to bundle the whole app before starting the dev server during development. The bigger the project, the slower the cold start. Vite takes a completely different approach:

```
Webpack: 源码 → 打包成 bundle → 启动 dev server → 浏览器加载 bundle
Vite:    启动 dev server → 浏览器按需请求模块 → 逐个编译
```

The core idea is to leverage the browser's native ES Module support. Nothing is bundled in development; each module is compiled on demand, only when the browser requests it:

```javascript
// 浏览器请求这个文件时，Vite 才做编译
// src/App.vue → 编译后返回给浏览器
import { createApp } from 'vue' // 这个也会被浏览器逐个请求
import App from './App.vue'

createApp(App).mount('#app')
```

Cold start drops from webpack's 30–60 seconds to under a second — and that's not a theoretical number, it's what I feel in real projects.

## Framework Agnostic: Not Just Vue

Vite 2.0's plugin system is compatible with Rollup and supports many frameworks:

```bash
# Vue 3
npm init vite@latest my-vue-app -- --template vue

# React
npm init vite@latest my-react-app -- --template react

# Preact
npm init vite@latest my-preact-app -- --template preact

# Svelte
npm init vite@latest my-svelte-app -- --template svelte
```

I recently migrated a React project from CRA to Vite; cold start dropped from 45 seconds to 1.2 seconds, and HMR latency is basically unnoticeable.

## Plugin System

Vite 2.0's plugin API extends the Rollup plugin interface, so frontend developers who've written Rollup plugins have almost nothing new to learn:

```javascript
// vite-plugin-my-feature.js
export default function myPlugin() {
  return {
    name: 'vite-plugin-my-feature',

    // 开发阶段的钩子
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        '<head>\n<script>window.__APP_VERSION__ = "1.0.0"</script>'
      )
    },

    // 处理特定文件
    transform(code, id) {
      if (id.endsWith('.svg')) {
        return `export default ${JSON.stringify(code)}`
      }
    },

    // 配置 dev server
    configureServer(server) {
      server.middlewares.use('/api/mock', (req, res) => {
        res.end(JSON.stringify({ data: 'mock' }))
      })
    }
  }
}
```

```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import myPlugin from './vite-plugin-my-feature'

export default defineConfig({
  plugins: [vue(), myPlugin()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

## Fundamental Differences from Webpack

| Dimension | Webpack 4/5 | Vite 2 |
|----------|-------------|---------|
| Dev build | Full bundle | On-demand compile |
| Production build | webpack | Rollup |
| Cold start | Slow (scales with project size) | Fast (barely related) |
| HMR | Rebuilds the affected module chain | Precise update, only changed modules processed |
| Config | Complex: loader + plugin | Concise: Rollup-compatible plugins |

One easily overlooked point: Vite's production build uses Rollup, which is already the best-in-class choice for tree-shaking and code optimization. So development gets Vite's on-demand strategy and production gets Rollup's mature bundling — the best of both worlds.

## Real-World Experience Migrating from Webpack

```bash
# 1. 安装 Vite
npm install -D vite @vitejs/plugin-vue

# 2. 修改 package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}

# 3. 创建 vite.config.ts
```

A few common migration gotchas:

```javascript
// ❌ process.env 在 Vite 中不可用（开发阶段是 ESM，没有 Node 环境）
const apiUrl = process.env.VUE_APP_API_URL

// ✅ 使用 import.meta.env，前缀改为 VITE_
const apiUrl = import.meta.env.VITE_API_URL

// .env 文件
// VUE_APP_API_URL=https://api.example.com  →  VITE_API_URL=https://api.example.com
```

```javascript
// ❌ require() 不可用
const modules = require.context('./modules', true, /\.ts$/)

// ✅ 改为 ESM 动态导入
const modules = import.meta.glob('./modules/**/*.ts')

// 懒加载版本
const modules = import.meta.glob('./modules/**/*.ts') // 返回懒加载函数
```

CSS preprocessors need no extra loader config — just install the dependency:

```bash
npm install -D sass
# 完了，直接在 .vue 文件里用 lang="scss" 就行
```

## Areas Still Maturing

To be fair, Vite 2.0 still has some rough edges:

1. **CommonJS dependencies**: they need pre-bundling (esbuild) in development, and you occasionally hit compatibility issues
2. **SSR support**: the basic framework is there, but it's not as turnkey as Nuxt yet
3. **Ecosystem**: the plugin count still lags behind webpack, but the core scenarios are covered
4. **Legacy browsers**: by default it only supports browsers with native ESM, so projects that need IE compatibility aren't a good fit yet

## Summary

- Vite 2.0 isn't just "fast" — it changes the paradigm of frontend build tooling at the architectural level
- It's framework-agnostic — works with Vue/React/Svelte — and Rollup plugin compatibility lowers the migration cost
- On migration, watch for `process.env` → `import.meta.env` and `require` → `import`
- For new projects, I'd just use Vite; for existing ones, weigh the migration cost
- The competitive landscape for frontend build tools shifted in 2021, and Vite is a serious contender
