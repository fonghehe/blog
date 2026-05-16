---
title: "Web Performance Optimization: A 2025 Methodology"
date: 2025-05-20 10:00:00
tags:
  - Performance Optimization
readingTime: 2
description: "After working through several performance optimization projects, I want to summarize the methodology rather than just scattered tips."
---

After working through several performance optimization projects, I want to summarize the methodology rather than just scattered tips.

## The Prerequisite: Measurement

```
No measurement, no optimization.

Bad approach:
"I feel like this page is slow, let's optimize it."

Good approach:
"P75 LCP is 4.2s, our goal is under 2.5s.
 Through Chrome DevTools analysis, the bottleneck is image loading and JS parsing."
```

Key metrics:

```
Core Web Vitals (user experience):
  LCP (Largest Contentful Paint) < 2.5s: main first-screen content loaded
  INP (Interaction to Next Paint) < 200ms: replaces FID
  CLS (Cumulative Layout Shift) < 0.1: page shouldn't jump around

Business metrics:
  TTFB (Time to First Byte): server response speed
  TTI (Time to Interactive): when the page can respond to user actions
  Bundle Size: JS bundle size
```

## Measurement Tools

```javascript
// 用 web-vitals 库上报
import { onCLS, onINP, onLCP, onTTFB } from "web-vitals";

function sendToAnalytics({ name, value, id, rating }) {
  // rating: 'good' | 'needs-improvement' | 'poor'
  analytics.track("web_vital", {
    metric: name,
    value: Math.round(value),
    id,
    rating,
    page: window.location.pathname,
  });
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

## LCP Optimization: Largest Contentful Paint

LCP is typically the large image or heading in the above-the-fold area.

```html
<!-- 1. preload 关键图片 -->
<link rel="preload" as="image" href="/hero-image.webp" fetchpriority="high" />

<!-- 2. 给 LCP 图片设置高优先级 -->
<img
  src="/hero-image.webp"
  fetchpriority="high"
  loading="eager"
  alt="首屏图片"
/>

<!-- 3. 其他图片懒加载 -->
<img src="/card-image.webp" loading="lazy" alt="卡片图片" />
```

```html
<!-- 4. 使用现代图片格式 -->
<picture>
  <source type="image/avif" srcset="/hero.avif" />
  <source type="image/webp" srcset="/hero.webp" />
  <img src="/hero.jpg" alt="首屏" />
</picture>
```

```typescript
// 5. 在 Next.js 里，优先用 <Image> 组件
import Image from 'next/image'

<Image
  src="/hero.webp"
  width={1200}
  height={600}
  priority  // 相当于 fetchpriority="high" + preload
  alt="首屏图片"
/>
```

## INP Optimization: Interaction Responsiveness

INP replaces FID and measures the time from user interaction to the next frame render.

```javascript
// 长任务会阻塞主线程，导致 INP 差
// 用 scheduler.yield() 让出主线程（Chrome 115+）

async function processLargeList(items) {
  const CHUNK_SIZE = 50;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    processChunk(chunk);

    // 每处理一批，让出主线程
    await scheduler.yield();
  }
}

// 降级方案
async function yieldToMain() {
  if ("scheduler" in window && "yield" in scheduler) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

```tsx
// React：用 startTransition 标记非紧急更新
import { startTransition, useState } from "react";

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  function handleSearch(value: string) {
    setQuery(value); // 紧急：立即更新输入框

    startTransition(() => {
      setResults(search(value)); // 非紧急：可以被打断
    });
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      <SearchResults results={results} />
    </>
  );
}
```

## Bundle Size Optimization

```javascript
// 代码分割：路由级别（Next.js 自动做了）

// 组件级别懒加载
const HeavyChart = lazy(() => import("./HeavyChart"));

// 条件加载
const MarkdownEditor = lazy(() =>
  import("./MarkdownEditor").then((m) => ({ default: m.MarkdownEditor })),
);

// 只在需要时加载
function Page() {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <button onClick={() => setEditorOpen(true)}>打开编辑器</button>
      {editorOpen && (
        <Suspense fallback={<div>加载编辑器...</div>}>
          <MarkdownEditor />
        </Suspense>
      )}
    </>
  );
}
```

```javascript
// 分析 Bundle Size
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  }
}

// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})
module.exports = withBundleAnalyzer({})
```

## My Optimization Workflow

```
1. Establish a baseline: run Lighthouse CI automatically in CI/CD
2. Collect real data: report web-vitals to an analytics platform
3. Identify bottlenecks: Profiler, Network waterfall
4. Prioritize: tackle the items affecting the most users with the best ROI first
5. Fix and validate: A/B test or compare before/after data
6. Monitor regressions: set Lighthouse CI thresholds—fail CI if metrics degrade
```

## Summary

- Measure first; no optimization without data
- Core Web Vitals are the key metrics in 2025 (LCP, INP, CLS)
- LCP: preload critical images, use modern formats, don't lazy-load above-the-fold images
- INP: avoid long tasks, use `scheduler.yield()` and `startTransition` to yield the main thread
- Bundle size: route-level code splitting + conditional lazy loading
- Add performance tests to CI to prevent regressions
