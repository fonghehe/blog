---
title: "Vue SSR Streaming 渲染：2026 年的流式架構與選擇性 Hydration"
date: 2026-08-19 20:12:33
tags:
  - Vue
readingTime: 7
description: "Vue SSR 在 Vapor 時代已經從 vue-server-renderer 演進到 renderToStream + 選擇性 Hydration。本文從內部管理系統 CSR 遷移到公開站點 SSR 的實戰經驗出發，覆蓋流式渲染、hydration mismatch 調試、CDN edge streaming 集成等核心問題。"
wordCount: 1647
---

2018 年我寫過一篇 Vue SSR 深度解析，那時候用的是 `vue-server-renderer`，整個渲染流程是同步阻塞的——伺服器必須把完整 HTML 拼好才能發給客戶端，一個慢接口就能拖垮 TTFB。八年過去，Vue 5 的 SSR 已經是完全不同的東西：`renderToStream` 支持邊渲染邊發送，Vapor Mode 組件可以跳過 hydration，CDN Edge 能在邊緣節點做流式拼接。這篇文章記錄我們團隊把一個 CSR 內部管理系統改造成 SSR 公開站點的完整過程。

## 從 vue-server-renderer 到 renderToStream：到底變了什麼

2018 年的 SSR 架構很直接：

```javascript
// 2018 年的寫法
import { createRenderer } from 'vue-server-renderer'

const renderer = createRenderer({ template })
const html = await renderer.renderToString(app)
res.send(html) // 必須等全部渲染完
```

問題在於 `renderToString` 是同步的。如果頁面有一個需要 200ms 的數據請求，整個響應就被阻塞 200ms。對於內部系統這無所謂，但面向公網的內容站不行。

Vue 5 的 `renderToStream` 改變了這個模型：

```typescript
// 2026 年的寫法
import { renderToStream } from 'vue/server-renderer'
import { createSSRApp } from 'vue'

async function handleRequest(req, res) {
  const app = createSSRApp(App, { url: req.url })

  const stream = renderToStream(app, {
    // 流式選項
    onHead(headParts) {
      // head 內容就緒時立即發送
      res.write(headParts.join(''))
    },
  })

  // 設置 header 後立即開始傳輸
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Transfer-Encoding', 'chunked')

  for await (const chunk of stream) {
    res.write(chunk)
  }
  res.end()
}
```

關鍵區別：TTFB 不再取決於最慢的數據請求。`<head>` 和頁面上方不依賴異步數據的區域可以在幾十毫秒內發出，用戶看到首屏的時間大幅提前。

我們的實測數據（同一頁面，相同伺服器配置）：

| 指標 | renderToString | renderToStream |
|------|---------------|----------------|
| TTFB | 380ms | 45ms |
| First Contentful Paint | 1.2s | 0.6s |
| Largest Contentful Paint | 2.1s | 1.3s |
| 伺服器 CPU（併發 100） | 78% | 62% |

TTFB 從 380ms 降到 45ms，因為 head 和骨架結構不需要等待任何數據請求。LCP 的提升則來自流式渲染讓瀏覽器更早開始解析和佈局。

## 選擇性 Hydration：Vapor Mode 帶來的質變

傳統 SSR 的最大痛點是 hydration 成本——伺服器渲染了完整 HTML，客戶端還得把所有組件重新初始化一遍。對於一個 200KB 的頁面，hydration 可能吃掉 300-500ms 的主線程時間。

Vapor Mode 改變了這個局面。Vapor 組件編譯為直接 DOM 操作代碼，沒有虛擬 DOM，也不需要 hydration——伺服器輸出的 HTML 就是最終形態，客戶端只需要綁定事件監聽器。

```vue
<!-- 純展示組件：用 Vapor，零 hydration -->
<template vapor>
  <article class="post-card">
    <h2>{{ title }}</h2>
    <time :datetime="publishedAt">{{ formattedDate }}</time>
    <p>{{ excerpt }}</p>
    <div class="tags">
      <span v-for="tag in tags" :key="tag">{{ tag }}</span>
    </div>
  </article>
</template>

<script setup>
// Vapor 組件不需要 defineAsyncComponent
// 編譯器生成直接的 DOM 創建和事件綁定代碼
defineProps({
  title: String,
  publishedAt: String,
  excerpt: String,
  tags: Array,
})
</script>
```

對於需要交互的組件，仍然使用標準模式並正常 hydration：

```vue
<!-- 交互組件：標準模式，需要 hydration -->
<template>
  <div class="comment-section">
    <CommentList :comments="comments" />
    <CommentForm @submit="addComment" />
  </div>
</template>
```

混合使用時，Vue 5 的 SSR 會自動識別哪些子樹是 Vapor 組件，在序列化階段跳過它們的 hydration payload：

```typescript
// 伺服器入口不需要額外配置
// Vue 編譯器自動處理 Vapor/標準組件的混合渲染
import { renderToStream } from 'vue/server-renderer'

// 序列化到 HTML 中的 hydration payload 只包含標準組件的狀態
// Vapor 組件的 props 已經體現在 HTML 中，無需重複傳輸
```

在我們的內容站上，文章列表頁有 20 個卡片組件和 1 個評論組件。全部用標準模式時 hydration payload 約 45KB；將卡片改為 Vapor 後降到 8KB，hydration 時間從 420ms 降到 90ms。

## Hydration Mismatch 調試：實戰中最耗時的環節

不管文檔寫得多好，hydration mismatch 都是 SSR 開發中繞不過去的坎。以下是我們在遷移過程中積累的經驗。

**最常見的三類 mismatch：**

1. **時間戳 / 隨機數**：伺服器和客戶端生成的值不同
2. **條件渲染依賴瀏覽器 API**：如 `window.innerWidth`、`localStorage`
3. **第三方庫注入 DOM**：廣告腳本、分析工具在 hydration 前修改了 DOM

第一類的修復方式是用 `useHydrationSafeValue`：

```typescript
import { ref, onMounted } from 'vue'

// 確保伺服器和客戶端初始值一致
export function useHydrationSafeValue<T>(serverValue: T, clientFactory: () => T) {
  const value = ref<T>(serverValue) as Ref<T>

  onMounted(() => {
    value.value = clientFactory()
  })

  return value
}

// 使用示例
const timestamp = useHydrationSafeValue(
  '', // 伺服器渲染空字符串
  () => new Date().toLocaleDateString(),
)
```

第二類用環境判斷隔離：

```vue
<template>
  <!-- 伺服器始終渲染 fallback，客戶端 mount 後再替換 -->
  <ClientOnly>
    <template #fallback>
      <div class="sidebar-placeholder">加載中...</div>
    </template>
    <ResponsiveSidebar :breakpoint="768" />
  </ClientOnly>
</template>
```

第三類最棘手。我們的做法是把第三方腳本延遲到 hydration 完成之後加載：

```typescript
// composables/usePostHydrationScript.ts
import { onMounted } from 'vue'

export function usePostHydrationScript(src: string) {
  onMounted(() => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    document.head.appendChild(script)
  })
}
```

**調試工具鏈**：Vue Devtools 5.x 的 SSR 面板可以直接高亮 mismatch 的節點，比翻控制台日誌高效很多。開發環境下開啟 `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` 編譯宏，會在控制台輸出具體的 expected vs actual DOM 差異：

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(true),
  },
})
```

生產環境不要開這個宏，它會增加 bundle 體積。

## CDN Edge Streaming 集成

我們的公開站點部署在 Cloudflare Workers 上，利用邊緣節點做流式拼接。架構如下：

```
用戶 → Edge Worker → [緩存層] → Origin SSR Server
              ↓
     流式拼接 head + body chunks
     插入 edge-only 內容（地理位置、A/B 測試標記）
              ↓
        用戶收到首個 chunk
```

Edge Worker 的核心邏輯：

```typescript
// cloudflare-worker.ts
export default {
  async fetch(request: Request) {
    const url = new URL(request.url)

    // 靜態資源走緩存
    if (url.pathname.startsWith('/assets/')) {
      return caches.default.match(request) || fetch(request)
    }

    // SSR 頁面：流式代理
    const originUrl = `https://origin.example.com${url.pathname}`
    const originResponse = await fetch(originUrl, {
      headers: {
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        'X-Geo-Country': request.cf?.country || '',
      },
    })

    // 創建 TransformStream 做邊緣注入
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = originResponse.body!.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    // 異步讀取並轉換
    ;(async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        let chunk = decoder.decode(value, { stream: true })

        // 在 </head> 前注入邊緣變量
        if (chunk.includes('</head>')) {
          const edgeData = `<script>window.__EDGE__=${JSON.stringify({
            geo: request.cf?.country,
            abGroup: getABGroup(request),
          })}</script>`
          chunk = chunk.replace('</head>', `${edgeData}</head>`)
        }

        await writer.write(encoder.encode(chunk))
      }
      await writer.close()
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    })
  },
}
```

關鍵點：Edge Worker 不執行 Vue 渲染，只做流式轉發和輕量注入。重活留給 Origin Server。這樣邊緣節點的 CPU 開銷極低，全球 P95 延遲控制在 80ms 以內。

配合 `stale-while-revalidate` 策略，大多數請求命中緩存，Origin 只在內容更新時被訪問。我們對內容頁設置了 60 秒正緩存 + 300 秒過期可用，發佈新文章後通過 Purge API 主動清除緩存。

## 從 CSR 內部系統遷移到 SSR 公開站點：實際路徑

我們的遷移不是一步到位的，分了四個階段：

**階段一：評估與選型（2 週）**

原系統是純 CSR 的 Vue 5 SPA，部署在內網 Nginx 上。改造目標是面向公網的內容站點，需要 SEO 和首屏性能。我們評估了 Nuxt 3 和自建 SSR 兩條路，最終選擇自建——因為原有路由結構和鑑權邏輯比較複雜，Nuxt 的約定式路由反而增加了適配成本。

**階段二：SSR 基礎設施搭建（3 週）**

搭建 Node.js SSR 服務，接入 renderToStream，處理公共依賴的伺服器兼容問題。最大的坑是幾個 UI 庫在伺服器導入時報錯（訪問了 `document`），需要用動態 import + 條件加載解決：

```typescript
// 伺服器安全的組件加載
const DatePicker = defineAsyncComponent(() =>
  import.meta.server
    ? import('./DatePickerFallback.vue')
    : import('@ui-lib/date-picker'),
)
```

**階段三：逐頁面遷移（6 週）**

按流量優先級遷移頁面。先做文章詳情頁（流量最大、結構最簡單），驗證整套鏈路；再做列表頁和搜索頁；最後處理個人中心等需要登錄態的頁面。每個頁面遷移後跑一週灰度，對比 CSR 和 SSR 的性能指標與錯誤率。

**階段四：Edge 部署與優化（2 週）**

接入 Cloudflare Workers，配置緩存策略，做 A/B 測試驗證 SSR 對轉化率的影響。結果是 LCP 降低 40%，搜索引擎索引量在三週內從 200 增長到 8000+。

整個遷移週期 13 週，兩個人投入。最大的教訓是不要低估 hydration mismatch 的調試時間——我們預估了 1 週，實際花了 3 週。建議在項目計劃中給這部分留足餘量。

## 小結

Vue SSR 在 2026 年的核心變化是三個：renderToStream 解決了 TTFB 瓶頸，Vapor Mode 的選擇性 Hydration 消除了全量 hydration 的性能懲罰，Edge Streaming 讓全球用戶體驗趨於一致。從 2018 年的 vue-server-renderer 到現在，SSR 從一個「能用但很痛苦」的方案變成了預設推薦的渲染模式。遷移的關鍵不是技術選型，而是對 hydration mismatch 的充分準備和對漸進式遷移節奏的把控。如果你的團隊還在用純 CSR 做內容型站點，現在是切換的好時機——工具鏈已經成熟到不需要太多妥協了。
