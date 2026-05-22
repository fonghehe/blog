---
title: "Vite 2.0：真正的下一代構建工具"
date: 2021-01-11 11:18:56
tags:
  - Vue
  - React
  - Webpack
  - Vite
  - Node.js
  - JavaScript
  - CSS
  - HTML
readingTime: 3
description: "Evan You 在 2021 年 1 月釋出了 Vite 2.0 正式版。和 1.0 相比，這幾乎是一次完全重寫——最大的變化是框架無關，不再隻服務 Vue 生態。作為一個從 Webpack 1 時代一路用過來的前端，Vite 給我的感受不隻是\"快\"，而是開發體驗的全面升級。"
wordCount: 724
---

Evan You 在 2021 年 1 月釋出了 Vite 2.0 正式版。和 1.0 相比，這幾乎是一次完全重寫——最大的變化是框架無關，不再隻服務 Vue 生態。作為一個從 Webpack 1 時代一路用過來的前端，Vite 給我的感受不隻是"快"，而是開發體驗的全面升級。

## 為什麼 Vite 這麼快

傳統構建工具（Webpack、Rollup）在開發階段需要先打包整個應用，再啟動 dev server。專案越大，冷啟動越慢。Vite 的思路完全不同：

```
Webpack: 原始碼 → 打包成 bundle → 啟動 dev server → 瀏覽器載入 bundle
Vite:    啟動 dev server → 瀏覽器按需請求模組 → 逐個編譯
```

核心原理是利用瀏覽器原生 ES Module 支援。開發時不打包，隻在瀏覽器請求時按需編譯：

```javascript
// 瀏覽器請求這個檔案時，Vite 才做編譯
// src/App.vue → 編譯後返回給瀏覽器
import { createApp } from 'vue' // 這個也會被瀏覽器逐個請求
import App from './App.vue'

createApp(App).mount('#app')
```

冷啟動時間從 Webpack 的 30-60 秒降到 1 秒以內，這不是理論值，是實際專案中的感受。

## 框架無關：不止 Vue

Vite 2.0 的外掛系統相容 Rollup，同時支援多種框架：

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

我最近把一個 React 專案從 CRA 遷移到 Vite，冷啟動從 45 秒降到了 1.2 秒，HMR 基本感覺不到延遲。

## 外掛系統

Vite 2.0 的外掛 API 基於 Rollup 外掛介面擴充套件，寫過 Rollup 外掛的前端幾乎沒有學習成本：

```javascript
// vite-plugin-my-feature.js
export default function myPlugin() {
  return {
    name: 'vite-plugin-my-feature',

    // 開發階段的鉤子
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        '<head>\n<script>window.__APP_VERSION__ = "1.0.0"</script>'
      )
    },

    // 處理特定檔案
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

## 和 Webpack 的本質區別

| 維度 | Webpack 4/5 | Vite 2 |
|
------|------------|--------|
| 開發構建 | 全量打包 | 按需編譯 |
| 生產構建 | webpack | Rollup |
| 冷啟動 | 慢（和專案大小正相關） | 快（幾乎無關） |
| HMR | 需重新構建受影響的模組鏈 | 精確更新，隻處理變更的模組 |
| 配置 | 複雜，loader + plugin | 簡潔，Rollup 相容外掛 |

一個容易忽略的點：Vite 生產構建用的是 Rollup，Rollup 在 tree-shaking 和程式碼最佳化上本來就是業界最好的選擇。等於開發用 Vite 的按需策略，生產用 Rollup 的成熟打包，兩頭都最優。

## 從 Webpack 遷移的實際經驗

```bash
# 1. 安裝 Vite
npm install -D vite @vitejs/plugin-vue

# 2. 修改 package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}

# 3. 建立 vite.config.ts
```

幾個常見的遷移坑：

```javascript
// ❌ process.env 在 Vite 中不可用（開發階段是 ESM，沒有 Node 環境）
const apiUrl = process.env.VUE_APP_API_URL

// ✅ 使用 import.meta.env，字首改為 VITE_
const apiUrl = import.meta.env.VITE_API_URL

// .env 檔案
// VUE_APP_API_URL=https://api.example.com  →  VITE_API_URL=https://api.example.com
```

```javascript
// ❌ require() 不可用
const modules = require.context('./modules', true, /\.ts$/)

// ✅ 改為 ESM 動態匯入
const modules = import.meta.glob('./modules/**/*.ts')

// 懶載入版本
const modules = import.meta.glob('./modules/**/*.ts') // 返回懶載入函式
```

CSS 前處理器不用額外配置 loader，安裝依賴即可：

```bash
npm install -D sass
# 完了，直接在 .vue 檔案裡用 lang="scss" 就行
```

## 還不成熟的地方

公平地說，Vite 2.0 也有一些不足：

1. **CommonJS 依賴**：開發階段需要預構建（esbuild），偶爾遇到相容問題
2. **SSR 支援**：基礎框架有了，但還不像 Nuxt 那樣開箱即用
3. **生態**：外掛數量和 Webpack 比還有差距，但核心場景覆蓋得差不多了
4. **老舊瀏覽器**：預設隻支援原生 ESM 的瀏覽器，需要相容 IE 的專案暫時不適合

## 小結

- Vite 2.0 不隻是"快"，是從架構層面改變了前端構建工具的範式
- 框架無關，Vue/React/Svelte 都能用，Rollup 外掛相容降低了遷移成本
- 遷移注意 `process.env` → `import.meta.env`、`require` → `import`
- 新專案建議直接用 Vite；老專案可以評估遷移成本
- 2021 年前端構建工具的競爭格局變了，Vite 是一個認真的選擇
