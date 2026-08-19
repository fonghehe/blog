---
title: "Vue SSR Streaming 渲染：2026 年的流式架构与选择性 Hydration"
date: 2026-08-19 20:12:33
tags:
  - Vue
readingTime: 9
description: "Vue SSR 在 Vapor 时代已经从 vue-server-renderer 演进到 renderToStream + 选择性 Hydration。本文从内部管理系统 CSR 迁移到公开站点 SSR 的实战经验出发，覆盖流式渲染、hydration mismatch 调试、CDN edge streaming 集成等核心问题。"
wordCount: 3500
---

2018 年我写过一篇 Vue SSR 深度解析，那时候用的是 `vue-server-renderer`，整个渲染流程是同步阻塞的——服务端必须把完整 HTML 拼好才能发给客户端，一个慢接口就能拖垮 TTFB。八年过去，Vue 5 的 SSR 已经是完全不同的东西：`renderToStream` 支持边渲染边发送，Vapor Mode 组件可以跳过 hydration，CDN Edge 能在边缘节点做流式拼接。这篇文章记录我们团队把一个 CSR 内部管理系统改造成 SSR 公开站点的完整过程。

## 从 vue-server-renderer 到 renderToStream：到底变了什么

2018 年的 SSR 架构很直接：

```javascript
// 2018 年的写法
import { createRenderer } from 'vue-server-renderer'

const renderer = createRenderer({ template })
const html = await renderer.renderToString(app)
res.send(html) // 必须等全部渲染完
```

问题在于 `renderToString` 是同步的。如果页面有一个需要 200ms 的数据请求，整个响应就被阻塞 200ms。对于内部系统这无所谓，但面向公网的内容站不行。

Vue 5 的 `renderToStream` 改变了这个模型：

```typescript
// 2026 年的写法
import { renderToStream } from 'vue/server-renderer'
import { createSSRApp } from 'vue'

async function handleRequest(req, res) {
  const app = createSSRApp(App, { url: req.url })

  const stream = renderToStream(app, {
    // 流式选项
    onHead(headParts) {
      // head 内容就绪时立即发送
      res.write(headParts.join(''))
    },
  })

  // 设置 header 后立即开始传输
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Transfer-Encoding', 'chunked')

  for await (const chunk of stream) {
    res.write(chunk)
  }
  res.end()
}
```

关键区别：TTFB 不再取决于最慢的数据请求。`<head>` 和页面上方不依赖异步数据的区域可以在几十毫秒内发出，用户看到首屏的时间大幅提前。

我们的实测数据（同一页面，相同服务器配置）：

| 指标 | renderToString | renderToStream |
|------|---------------|----------------|
| TTFB | 380ms | 45ms |
| First Contentful Paint | 1.2s | 0.6s |
| Largest Contentful Paint | 2.1s | 1.3s |
| 服务端 CPU（并发 100） | 78% | 62% |

TTFB 从 380ms 降到 45ms，因为 head 和骨架结构不需要等待任何数据请求。LCP 的提升则来自流式渲染让浏览器更早开始解析和布局。

## 选择性 Hydration：Vapor Mode 带来的质变

传统 SSR 的最大痛点是 hydration 成本——服务端渲染了完整 HTML，客户端还得把所有组件重新初始化一遍。对于一个 200KB 的页面，hydration 可能吃掉 300-500ms 的主线程时间。

Vapor Mode 改变了这个局面。Vapor 组件编译为直接 DOM 操作代码，没有虚拟 DOM，也不需要 hydration——服务端输出的 HTML 就是最终形态，客户端只需要绑定事件监听器。

```vue
<!-- 纯展示组件：用 Vapor，零 hydration -->
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
// Vapor 组件不需要 defineAsyncComponent
// 编译器生成直接的 DOM 创建和事件绑定代码
defineProps({
  title: String,
  publishedAt: String,
  excerpt: String,
  tags: Array,
})
</script>
```

对于需要交互的组件，仍然使用标准模式并正常 hydration：

```vue
<!-- 交互组件：标准模式，需要 hydration -->
<template>
  <div class="comment-section">
    <CommentList :comments="comments" />
    <CommentForm @submit="addComment" />
  </div>
</template>
```

混合使用时，Vue 5 的 SSR 会自动识别哪些子树是 Vapor 组件，在序列化阶段跳过它们的 hydration payload：

```typescript
// 服务端入口不需要额外配置
// Vue 编译器自动处理 Vapor/标准组件的混合渲染
import { renderToStream } from 'vue/server-renderer'

// 序列化到 HTML 中的 hydration payload 只包含标准组件的状态
// Vapor 组件的 props 已经体现在 HTML 中，无需重复传输
```

在我们的内容站上，文章列表页有 20 个卡片组件和 1 个评论组件。全部用标准模式时 hydration payload 约 45KB；将卡片改为 Vapor 后降到 8KB，hydration 时间从 420ms 降到 90ms。

## Hydration Mismatch 调试：实战中最耗时的环节

不管文档写得多好，hydration mismatch 都是 SSR 开发中绕不过去的坎。以下是我们在迁移过程中积累的经验。

**最常见的三类 mismatch：**

1. **时间戳 / 随机数**：服务端和客户端生成的值不同
2. **条件渲染依赖浏览器 API**：如 `window.innerWidth`、`localStorage`
3. **第三方库注入 DOM**：广告脚本、分析工具在 hydration 前修改了 DOM

第一类的修复方式是用 `useHydrationSafeValue`：

```typescript
import { ref, onMounted } from 'vue'

// 确保服务端和客户端初始值一致
export function useHydrationSafeValue<T>(serverValue: T, clientFactory: () => T) {
  const value = ref<T>(serverValue) as Ref<T>

  onMounted(() => {
    value.value = clientFactory()
  })

  return value
}

// 使用示例
const timestamp = useHydrationSafeValue(
  '', // 服务端渲染空字符串
  () => new Date().toLocaleDateString(),
)
```

第二类用环境判断隔离：

```vue
<template>
  <!-- 服务端始终渲染 fallback，客户端 mount 后再替换 -->
  <ClientOnly>
    <template #fallback>
      <div class="sidebar-placeholder">加载中...</div>
    </template>
    <ResponsiveSidebar :breakpoint="768" />
  </ClientOnly>
</template>
```

第三类最棘手。我们的做法是把第三方脚本延迟到 hydration 完成之后加载：

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

**调试工具链**：Vue Devtools 5.x 的 SSR 面板可以直接高亮 mismatch 的节点，比翻控制台日志高效很多。开发环境下开启 `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` 编译宏，会在控制台输出具体的 expected vs actual DOM 差异：

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(true),
  },
})
```

生产环境不要开这个宏，它会增加 bundle 体积。

## CDN Edge Streaming 集成

我们的公开站点部署在 Cloudflare Workers 上，利用边缘节点做流式拼接。架构如下：

```
用户 → Edge Worker → [缓存层] → Origin SSR Server
              ↓
     流式拼接 head + body chunks
     插入 edge-only 内容（地理位置、A/B 测试标记）
              ↓
        用户收到首个 chunk
```

Edge Worker 的核心逻辑：

```typescript
// cloudflare-worker.ts
export default {
  async fetch(request: Request) {
    const url = new URL(request.url)

    // 静态资源走缓存
    if (url.pathname.startsWith('/assets/')) {
      return caches.default.match(request) || fetch(request)
    }

    // SSR 页面：流式代理
    const originUrl = `https://origin.example.com${url.pathname}`
    const originResponse = await fetch(originUrl, {
      headers: {
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        'X-Geo-Country': request.cf?.country || '',
      },
    })

    // 创建 TransformStream 做边缘注入
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = originResponse.body!.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    // 异步读取并转换
    ;(async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        let chunk = decoder.decode(value, { stream: true })

        // 在 </head> 前注入边缘变量
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

关键点：Edge Worker 不执行 Vue 渲染，只做流式转发和轻量注入。重活留给 Origin Server。这样边缘节点的 CPU 开销极低，全球 P95 延迟控制在 80ms 以内。

配合 `stale-while-revalidate` 策略，大多数请求命中缓存，Origin 只在内容更新时被访问。我们对内容页设置了 60 秒正缓存 + 300 秒过期可用，发布新文章后通过 Purge API 主动清除缓存。

## 从 CSR 内部系统迁移到 SSR 公开站点：实际路径

我们的迁移不是一步到位的，分了四个阶段：

**阶段一：评估与选型（2 周）**

原系统是纯 CSR 的 Vue 5 SPA，部署在内网 Nginx 上。改造目标是面向公网的内容站点，需要 SEO 和首屏性能。我们评估了 Nuxt 3 和自建 SSR 两条路，最终选择自建——因为原有路由结构和鉴权逻辑比较复杂，Nuxt 的约定式路由反而增加了适配成本。

**阶段二：SSR 基础设施搭建（3 周）**

搭建 Node.js SSR 服务，接入 renderToStream，处理公共依赖的服务端兼容问题。最大的坑是几个 UI 库在服务端导入时报错（访问了 `document`），需要用动态 import + 条件加载解决：

```typescript
// 服务端安全的组件加载
const DatePicker = defineAsyncComponent(() =>
  import.meta.server
    ? import('./DatePickerFallback.vue')
    : import('@ui-lib/date-picker'),
)
```

**阶段三：逐页面迁移（6 周）**

按流量优先级迁移页面。先做文章详情页（流量最大、结构最简单），验证整套链路；再做列表页和搜索页；最后处理个人中心等需要登录态的页面。每个页面迁移后跑一周灰度，对比 CSR 和 SSR 的性能指标与错误率。

**阶段四：Edge 部署与优化（2 周）**

接入 Cloudflare Workers，配置缓存策略，做 A/B 测试验证 SSR 对转化率的影响。结果是 LCP 降低 40%，搜索引擎索引量在三周内从 200 增长到 8000+。

整个迁移周期 13 周，两个人投入。最大的教训是不要低估 hydration mismatch 的调试时间——我们预估了 1 周，实际花了 3 周。建议在项目计划中给这部分留足余量。

## 小结

Vue SSR 在 2026 年的核心变化是三个：renderToStream 解决了 TTFB 瓶颈，Vapor Mode 的选择性 Hydration 消除了全量 hydration 的性能惩罚，Edge Streaming 让全球用户体验趋于一致。从 2018 年的 vue-server-renderer 到现在，SSR 从一个"能用但很痛苦"的方案变成了默认推荐的渲染模式。迁移的关键不是技术选型，而是对 hydration mismatch 的充分准备和对渐进式迁移节奏的把控。如果你的团队还在用纯 CSR 做内容型站点，现在是切换的好时机——工具链已经成熟到不需要太多妥协了。
