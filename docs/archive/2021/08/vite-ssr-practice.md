---
title: "Vite SSR 实践"
date: 2021-08-09 15:28:34
tags:
  - Vite
  - Vue
readingTime: 2
description: "最近把一个内部运营平台从 CSR 迁移到了 Vite SSR，记录一下踩坑和经验。Vite 2.x 的 SSR 支持已经比较成熟了，但文档偏少，实际用起来还是有一些要注意的。"
wordCount: 283
---

最近把一个内部运营平台从 CSR 迁移到了 Vite SSR，记录一下踩坑和经验。Vite 2.x 的 SSR 支持已经比较成熟了，但文档偏少，实际用起来还是有一些要注意的。

## 基本架构

```
client/          # 客户端代码
  App.vue
  main.ts        # 客户端入口
  entry-client.ts # hydrate 入口
  entry-server.ts # 渲染入口
server/
  index.ts       # Express/Koa 服务端
```

## 服务端入口

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

// hydrate：把服务端渲染的 HTML "激活"为可交互的 SPA
router.isReady().then(() => {
  app.mount('#app', true) // true = hydrate 模式
})
```

## Express 服务

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

## 踩坑 1：CSS 处理

Vite SSR 默认不提取 CSS，需要手动处理：

```typescript
// 在渲染前收集样式
import { renderToString } from '@vue/server-renderer'

const app = createSSRApp(App)
const html = await renderToString(app)

// Vite SSR 的 CSS 会自动通过 manifest 注入
// 生产环境需要读取 manifest.json
```

生产构建需要 `ssrManifest`：

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

## 踩坑 2：浏览器 API 在服务端不可用

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

## 踩坑 3：数据预取

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

## 性能对比

| 指标 | CSR | SSR |
|
------|-----|-----|
| 首字节时间 | ~200ms | ~50ms |
| 首屏可见 | ~1.5s | ~0.3s |
| 可交互时间 | ~2s | ~1s |

内部运营平台对 SEO 没需求，但首屏速度提升明显，特别是弱网环境。

## 小结

- Vite SSR 开发体验很好（HMR、实时编译），但生产部署要注意 CSS 和静态资源处理
- 浏览器 API 的兼容是最大的坑，`import.meta.env.SSR` 是核心判断依据
- 数据预取需要额外设计（不像 Next.js 有完整的约定）
- 适合对首屏速度有要求的 Vue 3 项目；SEO 场景也可以用，但维护成本比 Nuxt 高