---
title: "Next.js 12 新特性解析"
date: 2021-10-18 16:44:59
tags:
  - Next.js
  - JavaScript
readingTime: 2
description: "Vercel 在 2021 年 10 月發佈了 Next.js 12，這是近年來最大的一次版本更新。Rust 編譯器、Middleware、React 18 支持，每個特性都很重磅。"
---

Vercel 在 2021 年 10 月發佈了 Next.js 12，這是近年來最大的一次版本更新。Rust 編譯器、Middleware、React 18 支持，每個特性都很重磅。

## Rust 編譯器

Next.js 12 用 SWC 替換了 Babel，編譯速度提升顯著：

```
基準測試（中型項目，約 200 個頁面）：

Babel（Next.js 11）:  初始編譯 ~35s，HMR ~800ms
SWC（Next.js 12）:    初始編譯 ~5s，  HMR ~50ms

提升約 5-7 倍
```

對用户來説是無感的升級——配置文件不需要改，但開發體驗肉眼變好了。而且 SWC 還承擔了代碼壓縮的工作，替代了 Terser：

```javascript
// next.config.js - 實際上不需要改任何配置
// SWC 會自動啓用，作為 Babel 和 Terser 的替代
// 只有需要自定義 Babel 配置時才需要 babel.config.js
module.exports = {
  // 如果項目有 babel.config.js，SWC 會跳過，建議刪除
  // 讓 Next.js 儘可能使用 SWC
}
```

## Middleware

這是 Next.js 12 最大的新特性——在請求到達頁面之前運行代碼：

```typescript
// pages/_middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 地理位置重定向
  const country = request.geo?.country || 'US'
  if (pathname === '/') {
    if (country === 'CN') {
      return NextResponse.redirect('/zh')
    }
    return NextResponse.redirect('/en')
  }

  // 認證檢查
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('auth-token')
    if (!token) {
      return NextResponse.redirect('/login')
    }
  }

  // A/B 測試
  if (pathname === '/pricing') {
    const bucket = Math.random() < 0.5 ? 'a' : 'b'
    const response = NextResponse.next()
    response.cookies.set('ab-bucket', bucket)
    return response
  }

  return NextResponse.next()
}
```

Middleware 運行在 Edge Runtime 上，比 Node.js 更輕量，響應更快。適合做認證、重定向、A/B 測試這類輕量邏輯。

## 圖片優化增強

```jsx
import Image from 'next/image'

// 支持模糊佔位符
<Image
  src="/hero.jpg"
  width={800}
  height={400}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."
  alt="Hero"
/>

// 自定義圖片加載器
// next.config.js
module.exports = {
  images: {
    loader: 'imgix', // 或 'cloudinary', 'akamai', 'custom'
    path: 'https://cdn.example.com/',
  }
}
```

## React 18 支持

Next.js 12 開始支持 React 18 的部分特性：

```jsx
// pages/index.js
import { Suspense } from 'react'

// 使用 React 18 的 Suspense 做流式 SSR
export default function Home() {
  return (
    <div>
      <Header />
      <Suspense fallback={<Skeleton />}>
        <AsyncComponent />
      </Suspense>
      <Footer />
    </div>
  )
}
```

配合 React 18 的 Streaming SSR，頁面可以先渲染骨架屏，再逐步填充內容，減少 TTFB。

## URL 導入（實驗性）

可以直接從 URL 導入模塊，不需要 npm 安裝：

```javascript
// 實驗性特性，需要在 next.config.js 中啓用
// next.config.js
module.exports = {
  experimental: {
    urlImports: ['https://esm.sh/']
  }
}

// 直接從 URL 導入
import confetti from 'https://esm.sh/canvas-confetti@1.4.0'

export default function Page() {
  return <button onClick={() => confetti()}>慶祝</button>
}
```

## 小結

- SWC 編譯器讓構建速度提升 5-7 倍，無配置升級
- Middleware 是 Next.js 12 最重要的新特性，運行在 Edge Runtime
- React 18 的 Suspense SSR 支持讓頁面加載體驗更好
- Rust 化是前端工具鏈的趨勢（SWC、esbuild、Vite 的 esbuild 預構建）
- Next.js 正在從 React 框架演進為全棧開發平台