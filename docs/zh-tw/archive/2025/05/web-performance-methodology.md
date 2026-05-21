---
title: "Web 效能最佳化：2025 年的方法論"
date: 2025-05-20 10:00:00
tags:
  - 效能最佳化
readingTime: 2
description: "做了幾個效能最佳化專案之後，想總結一下方法論，而不是零散的技巧。"
wordCount: 212
---

做了幾個效能最佳化專案之後，想總結一下方法論，而不是零散的技巧。

## 效能最佳化的前提：度量

```
沒有度量，就沒有最佳化。

壞的做法：
"我感覺這個頁面很慢，我們來最佳化一下"

好的做法：
"P75 的 LCP 是 4.2s，目標是 2.5s 以內，
 通過 Chrome DevTools 分析，瓶頸在圖片載入和 JS 解析"
```

關鍵指標：

```
Core Web Vitals（使用者體驗）：
  LCP（最大內容繪製）< 2.5s：首屏主要內容載入完成
  INP（互動到下一幀繪製）< 200ms：取代了 FID
  CLS（累積佈局位移）< 0.1：頁面不要跳來跳去

業務指標：
  TTFB（首位元組時間）：伺服器響應速度
  TTI（可互動時間）：頁面能響應使用者操作的時間
  Bundle Size：JS 包大小
```

## 度量工具

```javascript
// 用 web-vitals 庫上報
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

## LCP 最佳化：最大內容繪製

LCP 通常是首屏的大圖或大標題。

```html
<!-- 1. preload 關鍵圖片 -->
<link rel="preload" as="image" href="/hero-image.webp" fetchpriority="high" />

<!-- 2. 給 LCP 圖片設定高優先順序 -->
<img
  src="/hero-image.webp"
  fetchpriority="high"
  loading="eager"
  alt="首屏圖片"
/>

<!-- 3. 其他圖片懶載入 -->
<img src="/card-image.webp" loading="lazy" alt="卡片圖片" />
```

```html
<!-- 4. 使用現代圖片格式 -->
<picture>
  <source type="image/avif" srcset="/hero.avif" />
  <source type="image/webp" srcset="/hero.webp" />
  <img src="/hero.jpg" alt="首屏" />
</picture>
```

```typescript
// 5. 在 Next.js 裡，優先用 <Image> 元件
import Image from 'next/image'

<Image
  src="/hero.webp"
  width={1200}
  height={600}
  priority  // 相當於 fetchpriority="high" + preload
  alt="首屏圖片"
/>
```

## INP 最佳化：互動響應

INP 取代了 FID，測量的是使用者互動到下一幀渲染的時間。

```javascript
// 長任務會阻塞主執行緒，導致 INP 差
// 用 scheduler.yield() 讓出主執行緒（Chrome 115+）

async function processLargeList(items) {
  const CHUNK_SIZE = 50;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    processChunk(chunk);

    // 每處理一批，讓出主執行緒
    await scheduler.yield();
  }
}

// 降級方案
async function yieldToMain() {
  if ("scheduler" in window && "yield" in scheduler) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

```tsx
// React：用 startTransition 標記非緊急更新
import { startTransition, useState } from "react";

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  function handleSearch(value: string) {
    setQuery(value); // 緊急：立即更新輸入框

    startTransition(() => {
      setResults(search(value)); // 非緊急：可以被打斷
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

## Bundle Size 最佳化

```javascript
// 程式碼分割：路由級別（Next.js 自動做了）

// 元件級別懶載入
const HeavyChart = lazy(() => import("./HeavyChart"));

// 條件載入
const MarkdownEditor = lazy(() =>
  import("./MarkdownEditor").then((m) => ({ default: m.MarkdownEditor })),
);

// 只在需要時載入
function Page() {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <button onClick={() => setEditorOpen(true)}>開啟編輯器</button>
      {editorOpen && (
        <Suspense fallback={<div>載入編輯器...</div>}>
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

## 我的最佳化流程

```
1. 建立基線：用 Lighthouse CI 在 CI/CD 裡自動跑效能測試
2. 收集真實資料：web-vitals 上報到分析平臺
3. 識別瓶頸：Profiler、Network 瀑布圖
4. 優先順序排序：影響最多使用者、投入產出比最高的先做
5. 修復驗證：A/B 測試或對比前後資料
6. 監控迴歸：Lighthouse CI 設定閾值，變差了 CI 失敗
```

## 小結

- 度量先行，沒有資料不談最佳化
- Core Web Vitals 是 2025 年的主要指標（LCP、INP、CLS）
- LCP：preload 關鍵圖片，使用現代格式，不要懶載入首屏圖
- INP：避免長任務，用 scheduler.yield() 和 startTransition 讓出主執行緒
- Bundle Size：路由級別程式碼分割 + 條件懶載入
- 把效能測試加入 CI，防止迴歸
