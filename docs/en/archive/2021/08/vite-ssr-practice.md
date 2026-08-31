---
title: "Vite SSR in Practice"
date: 2021-08-09 15:28:34
tags:
  - Vite
  - Vue
  - React

readingTime: 2
description: "I recently migrated an internal operations platform from CSR to Vite SSR — here are the pitfalls and lessons. Vite 2.x SSR support is fairly mature, but documentation is thin, and there are still things to watch out for in practice."
wordCount: 206
---

I recently migrated an internal operations platform from CSR to Vite SSR, and I'm noting down the pitfalls and lessons learned. SSR support in Vite 2.x is already fairly mature, but documentation is sparse, so there are still a few things to watch out for in practice.

## Basic Architecture

```
client/          # 客户端代码
  App.vue
  main.ts        # 客户端入口
  entry-client.ts # hydrate 入口
  entry-server.ts # 渲染入口
server/
  index.ts       # Express/Koa 服务端
```

## Server Entry

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

## Client Entry

```typescript
// entry-client.ts
import { createApp } from 'vue'
import { createRouter } from './router'
import App from './App.vue'

const app = createApp(App)
const router = createRouter()

app.use(router)

// hydrate：把服务端渲染的 HTML "激活"为可交互的 SPA
router.isReady().then(() => {
  app.mount('#app', true) // true = hydrate 模式
})
```

## Express Service

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
      // 读取 index.html 模板
      let template = fs.readFileSync(
        path.resolve(__dirname, '../index.html'),
        'utf-8'
      )

      // Vite 转换模板（注入 HMR 客户端等）
      template = await vite.transformIndexHtml(url, template)

      // 加载服务端入口（Vite 会实时编译）
      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')

      const appHtml = await render(url)

      // 替换占位符
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

## Pitfall 1: CSS Handling

Vite SSR doesn't extract CSS by default, so you need to handle it manually:

```typescript
// 在渲染前收集样式
import { renderToString } from '@vue/server-renderer'

const app = createSSRApp(App)
const html = await renderToString(app)

// Vite SSR 的 CSS 会自动通过 manifest 注入
// 生产环境需要读取 manifest.json
```

Production builds require `ssrManifest`:

```bash
# 构建客户端（生成 ssr-manifest.json）
vite build --outDir dist/client --ssrManifest

# 构建服务端
vite build --outDir dist/server --ssr src/entry-server.ts
```

```typescript
// 生产环境 server/index.ts
import express from 'express'
import fs from 'fs'
import path from 'path'
import { render } from '../dist/server/entry-server.js'

const app = express()

// 静态资源
app.use(express.static(path.resolve(__dirname, '../dist/client'), {
  index: false, // 不自动返回 index.html
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

    // 从 manifest 中找出当前页面依赖的 CSS/JS
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

## Pitfall 2: Browser APIs Unavailable on Server

```typescript
// ❌ 服务端没有 window/document/localStorage
const token = localStorage.getItem('token')

// ✅ 用条件判断
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token')
  }
  return null
}

// ✅ 或者用 import.meta.env.SSR（Vite 提供）
if (!import.meta.env.SSR) {
  // 这段代码只会出现在客户端 bundle
  initAnalytics()
}
```

## Pitfall 3: Data Prefetching

```typescript
// 推荐：组件定义 asyncData，路由匹配后在服务端调用
// composables/useAsyncData.ts
export function useAsyncData<T>(key: string, fetcher: () => Promise<T>) {
  const data = ref<T | null>(null)
  const pending = ref(true)

  // 服务端：直接调用
  // 客户端：检查 window.__SSR_DATA__
  if (import.meta.env.SSR) {
    // 服务端执行，结果通过 HTML 注入
  } else {
    // 客户端 hydrate 时从 __SSR_DATA__ 读取
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

## Performance Comparison

| Metric | CSR | SSR |
|------|-----|-----|
| 首字节时间 | ~200ms | ~50ms |
| 首屏可见 | ~1.5s | ~0.3s |
| 可交互时间 | ~2s | ~1s |

Our internal operations platform has no SEO needs, but the first-paint speed improvement is obvious, especially on weak networks.

## Summary

- Vite SSR has a great dev experience (HMR and on-the-fly compilation), but production deployment requires care with CSS and static assets
- Browser API compatibility is the biggest pitfall, and `import.meta.env.SSR` is the key thing to check
- Data prefetching needs extra design (unlike Next.js, which has full conventions for it)
- It suits Vue 3 projects that care about first-paint speed; it can also work for SEO, but the maintenance cost is higher than Nuxt