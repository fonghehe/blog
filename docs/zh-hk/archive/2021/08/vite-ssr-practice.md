---
title: "Vite SSR 實踐"
date: 2021-08-09 15:28:34
tags:
  - Vite
  - Vue
readingTime: 2
description: "最近把一個內部運營平台從 CSR 遷移到了 Vite SSR，記錄一下踩坑和經驗。Vite 2.x 的 SSR 支持已經比較成熟了，但文檔偏少，實際用起來還是有一些要注意的。"
wordCount: 283
---

最近把一個內部運營平台從 CSR 遷移到了 Vite SSR，記錄一下踩坑和經驗。Vite 2.x 的 SSR 支持已經比較成熟了，但文檔偏少，實際用起來還是有一些要注意的。

## 基本架構

```
client/          # 客户端代碼
  App.vue
  main.ts        # 客户端入口
  entry-client.ts # hydrate 入口
  entry-server.ts # 渲染入口
server/
  index.ts       # Express/Koa 服務端
```

## 服務端入口

```typescript
// entry-server.ts
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRouter } from '../router'
import App from '../App.vue'

export async function render(url: string) {
  const app = createSSRApp(App)
  const router = createRouter()

  app.use(router)
  await router.push(url)
  await router.isReady()

  const html = await renderToString(app)
  return html
}
```

## 客户端入口

```typescript
// entry-client.ts
import { createApp } from 'vue'
import { createRouter } from './router'
import App from './App.vue'

const app = createApp(App)
const router = createRouter()

app.use(router)

// hydrate：把服務端渲染的 HTML "激活"為可交互的 SPA
router.isReady().then(() => {
  app.mount('#app', true) // true = hydrate 模式
})
```

## Express 服務

```typescript
// server/index.ts
import express from 'express'
import fs from 'fs'
import path from 'path'
import { createServer as createViteServer } from 'vite'

async function startServer() {
  const app = express()

  const vite = await createViteServer({
    server: { middlewareMode: 'ssr' },
    appType: 'custom',
  })

  app.use(vite.middlewares)

  app.use('*', async (req, res) => {
    const url = req.originalUrl

    try {
      // 讀取 index.html 模板
      let template = fs.readFileSync(
        path.resolve(__dirname, '../index.html'),
        'utf-8'
      )

      // Vite 轉換模板（注入 HMR 客户端等）
      template = await vite.transformIndexHtml(url, template)

      // 加載服務端入口（Vite 會實時編譯）
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')

      const appHtml = await render(url)

      // 替換佔位符
      const html = template.replace('<!--ssr-outlet-->', appHtml)

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      vite.ssrFixStacktrace(e as Error)
      console.error(e)
      res.status(500).end((e as Error).message)
    }
  })

  app.listen(3000)
}

startServer()
```

## 踩坑 1：CSS 處理

Vite SSR 默認不提取 CSS，需要手動處理：

```typescript
// 在渲染前收集樣式
import { renderToString } from '@vue/server-renderer'

const app = createSSRApp(App)
const html = await renderToString(app)

// Vite SSR 的 CSS 會自動通過 manifest 注入
// 生產環境需要讀取 manifest.json
```

生產構建需要 `ssrManifest`：

```bash
# 構建客户端（生成 ssr-manifest.json）
vite build --outDir dist/client --ssrManifest

# 構建服務端
vite build --outDir dist/server --ssr src/entry-server.ts
```

```typescript
// 生產環境 server/index.ts
import express from 'express'
import fs from 'fs'
import path from 'path'
import { render } from '../dist/server/entry-server.js'

const app = express()

// 靜態資源
app.use(express.static(path.resolve(__dirname, '../dist/client'), {
  index: false, // 不自動返回 index.html
}))

// SSR manifest
const manifest = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../dist/client/ssr-manifest.json'),
    'utf-8'
  )
)

app.use('*', async (req, res) => {
  const url = req.originalUrl

  try {
    let template = fs.readFileSync(
      path.resolve(__dirname, '../dist/client/index.html'),
      'utf-8'
    )

    const appHtml = await render(url, manifest)

    // 從 manifest 中找出當前頁面依賴的 CSS/JS
    const preloadLinks = renderPreloadLinks(appHtml, manifest)

    const html = template
      .replace('<!--preload-links-->', preloadLinks)
      .replace('<!--ssr-outlet-->', appHtml)

    res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
  } catch (e) {
    console.error(e)
    res.status(500).end((e as Error).message)
  }
})
```

## 踩坑 2：瀏覽器 API 在服務端不可用

```typescript
// ❌ 服務端沒有 window/document/localStorage
const token = localStorage.getItem('token')

// ✅ 用條件判斷
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token')
  }
  return null
}

// ✅ 或者用 import.meta.env.SSR（Vite 提供）
if (!import.meta.env.SSR) {
  // 這段代碼只會出現在客户端 bundle
  initAnalytics()
}
```

## 踩坑 3：數據預取

```typescript
// 推薦：組件定義 asyncData，路由匹配後在服務端調用
// composables/useAsyncData.ts
export function useAsyncData<T>(key: string, fetcher: () => Promise<T>) {
  const data = ref<T | null>(null)
  const pending = ref(true)

  // 服務端：直接調用
  // 客户端：檢查 window.__SSR_DATA__
  if (import.meta.env.SSR) {
    // 服務端執行，結果通過 HTML 注入
  } else {
    // 客户端 hydrate 時從 __SSR_DATA__ 讀取
    const ssrData = (window as any).__SSR_DATA__
    if (ssrData?.[key]) {
      data.value = ssrData[key]
      pending.value = false
    } else {
      fetcher().then((res) => {
        data.value = res
        pending.value = false
      })
    }
  }

  return { data, pending }
}
```

## 性能對比

| 指標 | CSR | SSR |
|
------|-----|-----|
| 首字節時間 | ~200ms | ~50ms |
| 首屏可見 | ~1.5s | ~0.3s |
| 可交互時間 | ~2s | ~1s |

內部運營平台對 SEO 沒需求，但首屏速度提升明顯，特別是弱網環境。

## 小結

- Vite SSR 開發體驗很好（HMR、實時編譯），但生產部署要注意 CSS 和靜態資源處理
- 瀏覽器 API 的兼容是最大的坑，`import.meta.env.SSR` 是核心判斷依據
- 數據預取需要額外設計（不像 Next.js 有完整的約定）
- 適合對首屏速度有要求的 Vue 3 項目；SEO 場景也可以用，但維護成本比 Nuxt 高