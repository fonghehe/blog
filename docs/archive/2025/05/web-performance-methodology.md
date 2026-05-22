---
title: "Web 性能优化：2025 年的方法论"
date: 2025-05-20 09:54:31
tags:
  - 性能优化
readingTime: 2
description: "做了几个性能优化项目之后，想总结一下方法论，而不是零散的技巧。"
wordCount: 202
---

做了几个性能优化项目之后，想总结一下方法论，而不是零散的技巧。

## 性能优化的前提：度量

```
没有度量，就没有优化。

坏的做法：
"我感觉这个页面很慢，我们来优化一下"

好的做法：
"P75 的 LCP 是 4.2s，目标是 2.5s 以内，
 通过 Chrome DevTools 分析，瓶颈在图片加载和 JS 解析"
```

关键指标：

```
Core Web Vitals（用户体验）：
  LCP（最大内容绘制）< 2.5s：首屏主要内容加载完成
  INP（交互到下一帧绘制）< 200ms：取代了 FID
  CLS（累积布局位移）< 0.1：页面不要跳来跳去

业务指标：
  TTFB（首字节时间）：服务器响应速度
  TTI（可交互时间）：页面能响应用户操作的时间
  Bundle Size：JS 包大小
```

## 度量工具

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

## LCP 优化：最大内容绘制

LCP 通常是首屏的大图或大标题。

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

## INP 优化：交互响应

INP 取代了 FID，测量的是用户交互到下一帧渲染的时间。

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

## Bundle Size 优化

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

## 我的优化流程

```
1. 建立基线：用 Lighthouse CI 在 CI/CD 里自动跑性能测试
2. 收集真实数据：web-vitals 上报到分析平台
3. 识别瓶颈：Profiler、Network 瀑布图
4. 优先级排序：影响最多用户、投入产出比最高的先做
5. 修复验证：A/B 测试或对比前后数据
6. 监控回归：Lighthouse CI 设置阈值，变差了 CI 失败
```

## 小结

- 度量先行，没有数据不谈优化
- Core Web Vitals 是 2025 年的主要指标（LCP、INP、CLS）
- LCP：preload 关键图片，使用现代格式，不要懒加载首屏图
- INP：避免长任务，用 scheduler.yield() 和 startTransition 让出主线程
- Bundle Size：路由级别代码分割 + 条件懒加载
- 把性能测试加入 CI，防止回归
