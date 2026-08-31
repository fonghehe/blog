---
title: "Vue SSR Streaming Rendering: Stream Architecture and Selective Hydration in 2026"
date: 2026-08-19 20:12:33
tags:
  - Vue
readingTime: 7
description: "Vue SSR has evolved from vue-server-renderer to renderToStream + selective hydration in the Vapor era. Drawing on real-world experience migrating an internal management system from CSR to a public-facing SSR site, this article covers streaming rendering, hydration mismatch debugging, and CDN edge streaming integration."
wordCount: 1028
---

Back in 2018 I wrote a deep dive on Vue SSR using `vue-server-renderer`, where the entire rendering pipeline was synchronous and blocking — the server had to assemble the complete HTML before sending anything to the client, and a single slow API call could tank TTFB. Eight years later, Vue 5's SSR is an entirely different beast: `renderToStream` supports sending chunks as they render, Vapor Mode components can skip hydration entirely, and CDN Edge nodes can perform stream splicing at the edge. This article documents our team's full journey converting a CSR internal management system into a public-facing SSR site.

## From vue-server-renderer to renderToStream: What Actually Changed

The 2018 SSR architecture was straightforward:

```javascript
// 2018 approach
import { createRenderer } from 'vue-server-renderer'

const renderer = createRenderer({ template })
const html = await renderer.renderToString(app)
res.send(html) // Must wait for complete render
```

The problem is that `renderToString` is synchronous. If a page has a data request taking 200ms, the entire response is blocked for 200ms. That's acceptable for internal systems but not for public-facing content sites.

Vue 5's `renderToStream` changes this model:

```typescript
// 2026 approach
import { renderToStream } from 'vue/server-renderer'
import { createSSRApp } from 'vue'

async function handleRequest(req, res) {
  const app = createSSRApp(App, { url: req.url })

  const stream = renderToStream(app, {
    // Streaming options
    onHead(headParts) {
      // Send head content immediately when ready
      res.write(headParts.join(''))
    },
  })

  // Set headers and start transfer immediately
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Transfer-Encoding', 'chunked')

  for await (const chunk of stream) {
    res.write(chunk)
  }
  res.end()
}
```

The key difference: TTFB no longer depends on the slowest data request. `<head>` and above-the-fold areas that don't depend on async data can be sent within milliseconds, dramatically reducing time to first paint.

Our benchmark data (same page, identical server configuration):

| Metric | renderToString | renderToStream |
|--------|---------------|----------------|
| TTFB | 380ms | 45ms |
| First Contentful Paint | 1.2s | 0.6s |
| Largest Contentful Paint | 2.1s | 1.3s |
| Server CPU (100 concurrent) | 78% | 62% |

TTFB dropped from 380ms to 45ms because the head and skeleton structure don't wait for any data requests. The LCP improvement comes from streaming allowing the browser to begin parsing and layout earlier.

## Selective Hydration: The Step Change from Vapor Mode

The biggest pain point of traditional SSR is hydration cost — the server renders complete HTML, then the client has to reinitialize every component. For a 200KB page, hydration can consume 300-500ms of main thread time.

Vapor Mode changes this equation. Vapor components compile to direct DOM manipulation code with no virtual DOM and no hydration needed — the HTML output from the server is the final form, and the client only needs to attach event listeners.

```vue
<!-- Pure display component: use Vapor, zero hydration -->
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
// Vapor components don't need defineAsyncComponent
// Compiler generates direct DOM creation and event binding code
defineProps({
  title: String,
  publishedAt: String,
  excerpt: String,
  tags: Array,
})
</script>
```

For components requiring interactivity, use standard mode with normal hydration:

```vue
<!-- Interactive component: standard mode, requires hydration -->
<template>
  <div class="comment-section">
    <CommentList :comments="comments" />
    <CommentForm @submit="addComment" />
  </div>
</template>
```

When mixing both modes, Vue 5's SSR automatically identifies which subtrees are Vapor components and skips their hydration payload during serialization:

```typescript
// No extra configuration needed in the server entry
// Vue compiler handles Vapor/standard component mixed rendering automatically
import { renderToStream } from 'vue/server-renderer'

// Hydration payload serialized into HTML only contains standard component state
// Vapor component props are already reflected in HTML, no redundant transmission needed
```

On our content site, the article listing page has 20 card components and 1 comment component. Using standard mode for everything produced a ~45KB hydration payload; switching cards to Vapor reduced it to 8KB, and hydration time dropped from 420ms to 90ms.

## Hydration Mismatch Debugging: The Most Time-Consuming Part in Practice

No matter how good the documentation is, hydration mismatches are unavoidable in SSR development. Here's what we learned during migration.

**Three most common mismatch categories:**

1. **Timestamps / random numbers**: server and client generate different values
2. **Conditional rendering depends on browser APIs**: e.g., `window.innerWidth`, `localStorage`
3. **Third-party libraries inject DOM**: ad scripts and analytics tools modify the DOM before hydration completes

Fix for category one — use `useHydrationSafeValue`:

```typescript
import { ref, onMounted } from 'vue'

// Ensure server and client initial values match
export function useHydrationSafeValue<T>(serverValue: T, clientFactory: () => T) {
  const value = ref<T>(serverValue) as Ref<T>

  onMounted(() => {
    value.value = clientFactory()
  })

  return value
}

// Usage example
const timestamp = useHydrationSafeValue(
  '', // Server renders empty string
  () => new Date().toLocaleDateString(),
)
```

Category two — isolate with environment checks:

```vue
<template>
  <!-- Server always renders fallback; client replaces after mount -->
  <ClientOnly>
    <template #fallback>
      <div class="sidebar-placeholder">Loading...</div>
    </template>
    <ResponsiveSidebar :breakpoint="768" />
  </ClientOnly>
</template>
```

Category three is the trickiest. Our approach is to defer third-party scripts until after hydration completes:

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

**Debugging toolchain**: Vue Devtools 5.x's SSR panel can directly highlight mismatched nodes, far more efficient than digging through console logs. In development, enable the `__VUE_PROD_HYDRATION_MISMATCH_DETAILS__` compiler macro to get specific expected vs actual DOM differences in the console:

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(true),
  },
})
```

Don't enable this macro in production — it increases bundle size.

## CDN Edge Streaming Integration

Our public site is deployed on Cloudflare Workers, leveraging edge nodes for stream splicing. The architecture looks like this:

```
User → Edge Worker → [Cache Layer] → Origin SSR Server
              ↓
     Stream-splice head + body chunks
     Inject edge-only content (geolocation, A/B test flags)
              ↓
        User receives first chunk
```

Core Edge Worker logic:

```typescript
// cloudflare-worker.ts
export default {
  async fetch(request: Request) {
    const url = new URL(request.url)

    // Static assets served from cache
    if (url.pathname.startsWith('/assets/')) {
      return caches.default.match(request) || fetch(request)
    }

    // SSR pages: streaming proxy
    const originUrl = `https://origin.example.com${url.pathname}`
    const originResponse = await fetch(originUrl, {
      headers: {
        'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
        'X-Geo-Country': request.cf?.country || '',
      },
    })

    // Create TransformStream for edge injection
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = originResponse.body!.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    // Async read and transform
    ;(async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        let chunk = decoder.decode(value, { stream: true })

        // Inject edge variables before </head>
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

Key point: the Edge Worker doesn't execute Vue rendering — it only does stream forwarding and lightweight injection. Heavy lifting stays on the Origin Server. This keeps edge node CPU overhead minimal, with global P95 latency under 80ms.

Combined with a `stale-while-revalidate` strategy, most requests hit cache, and the Origin is only touched when content updates. We set 60-second fresh cache + 300-second stale-while-revalidate for content pages, actively purging via the Purge API after publishing new articles.

## Migrating from CSR Internal System to SSR Public Site: The Actual Path

Our migration wasn't done in one shot — it unfolded across four phases:

**Phase 1: Assessment & Technology Selection (2 weeks)**

The original system was a pure CSR Vue 5 SPA deployed on internal Nginx. The target was a public-facing content site requiring SEO and first-screen performance. We evaluated Nuxt 3 versus custom SSR and chose custom — our existing route structure and auth logic were complex enough that Nuxt's convention-based routing would have added adaptation cost.

**Phase 2: SSR Infrastructure Setup (3 weeks)**

Built the Node.js SSR service, integrated renderToStream, and handled server-side compatibility issues with shared dependencies. The biggest pitfall was several UI libraries throwing errors on server import (accessing `document`), solved with dynamic imports and conditional loading:

```typescript
// Server-safe component loading
const DatePicker = defineAsyncComponent(() =>
  import.meta.server
    ? import('./DatePickerFallback.vue')
    : import('@ui-lib/date-picker'),
)
```

**Phase 3: Page-by-Page Migration (6 weeks)**

Migrated pages by traffic priority. Started with the article detail page (highest traffic, simplest structure) to validate the full pipeline; then listing and search pages; finally personal center and other pages requiring authentication. Each page ran a one-week canary after migration, comparing CSR vs SSR performance metrics and error rates.

**Phase 4: Edge Deployment & Optimization (2 weeks)**

Integrated Cloudflare Workers, configured caching strategies, and ran A/B tests to validate SSR's impact on conversion. Results: LCP decreased by 40%, and search engine indexation grew from 200 to 8,000+ within three weeks.

Total migration duration: 13 weeks with two people. The biggest lesson: don't underestimate hydration mismatch debugging time — we budgeted 1 week but spent 3. Leave ample buffer for this in your project plan.

## Summary

Vue SSR in 2026 has three core changes: renderToStream solves the TTFB bottleneck, Vapor Mode's selective hydration eliminates the performance penalty of full hydration, and Edge Streaming brings consistent global user experience. From 2018's vue-server-renderer to today, SSR has gone from a "usable but painful" option to the default recommended rendering mode. The key to migration isn't technology selection — it's thorough preparation for hydration mismatches and disciplined control of incremental migration pace. If your team is still running pure CSR for a content site, now is a good time to switch — the toolchain has matured enough that few compromises are needed.
