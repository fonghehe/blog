---
title: "Vite 2.0：真の次世代ビルドツール"
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
description: "Evan You 在 2021 年 1 月发布了 Vite 2.0 正式版。和 1.0 相比，这几乎是一次完全重写——最大的变化是框架无关，不再只服务 Vue 生态。作为一个从 Webpack 1 时代一路用过来的前端，Vite 给我的感受不只是\"快\"，而是开发体验的全面升级。"
---

Evan You 在 2021 年 1 月发布了 Vite 2.0 正式版。和 1.0 相比，这几乎是一次完全重写——最大的变化是框架无关，不再只服务 Vue 生态。作为一个从 Webpack 1 时代一路用过来的前端，Vite 给我的感受不只是"快"，而是开发体验的全面升级。

## なぜ Vite は速いのか

传统构建工具（Webpack、Rollup）在开发阶段需要先打包整个应用，再启动 dev server。项目越大，冷启动越慢。Vite 的思路完全不同：

```
Webpack: 源码 → 打包成 bundle → 启动 dev server → 浏览器加载 bundle
Vite:    启动 dev server → 浏览器按需请求模块 → 逐个编译
```

核心原理是利用浏览器原生 ES Module 支持。开发时不打包，只在浏览器请求时按需编译：

```javascript
// 浏览器请求这个文件时，Vite 才做编译
// src/App.vue → 编译后返回给浏览器
import { createApp } from 'vue' // 这个也会被浏览器逐个请求
import App from './App.vue'

createApp(App).mount('#app')
```

冷启动时间从 Webpack 的 30-60 秒降到 1 秒以内，这不是理论值，是实际项目中的感受。

## フレームワーク非依存：Vueだけではない

Vite 2.0 的插件系统兼容 Rollup，同时支持多种框架：

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

我最近把一个 React 项目从 CRA 迁移到 Vite，冷启动从 45 秒降到了 1.2 秒，HMR 基本感觉不到延迟。

## プラグインシステム

Vite 2.0 的插件 API 基于 Rollup 插件接口扩展，写过 Rollup 插件的前端几乎没有学习成本：

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

## Webpack との本質的な違い

| 维度 | Webpack 4/5 | Vite 2 |
|------|------------|--------|
| 开发构建 | 全量打包 | 按需编译 |
| 生产构建 | webpack | Rollup |
| 冷启动 | 慢（和项目大小正相关） | 快（几乎无关） |
| HMR | 需重新构建受影响的模块链 | 精确更新，只处理变更的模块 |
| 配置 | 复杂，loader + plugin | 简洁，Rollup 兼容插件 |

一个容易忽略的点：Vite 生产构建用的是 Rollup，Rollup 在 tree-shaking 和代码优化上本来就是业界最好的选择。等于开发用 Vite 的按需策略，生产用 Rollup 的成熟打包，两头都最优。

## Webpack からの移行の実際の経験

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

几个常见的迁移坑：

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

CSS 预处理器不用额外配置 loader，安装依赖即可：

```bash
npm install -D sass
# 完了，直接在 .vue 文件里用 lang="scss" 就行
```

## まだ成熟していない点

公平地说，Vite 2.0 也有一些不足：

1. **CommonJS 依赖**：开发阶段需要预构建（esbuild），偶尔遇到兼容问题
2. **SSR 支持**：基础框架有了，但还不像 Nuxt 那样开箱即用
3. **生态**：插件数量和 Webpack 比还有差距，但核心场景覆盖得差不多了
4. **老旧浏览器**：默认只支持原生 ESM 的浏览器，需要兼容 IE 的项目暂时不适合

## まとめ

- Vite 2.0 不只是"快"，是从架构层面改变了前端构建工具的范式
- 框架无关，Vue/React/Svelte 都能用，Rollup 插件兼容降低了迁移成本
- 迁移注意 `process.env` → `import.meta.env`、`require` → `import`
- 新项目建议直接用 Vite；老项目可以评估迁移成本
- 2021 年前端构建工具的竞争格局变了，Vite 是一个认真的选择
