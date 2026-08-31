---
title: "Next.js 12 New Features Explained"
date: 2021-10-18 16:44:59
tags:
  - React
  - JavaScript

readingTime: 2
description: "Vercel released Next.js 12 in October 2021 — the biggest version update in recent years. A Rust compiler, Middleware, React 18 support: every feature is significant."
wordCount: 231
---

In October 2021, Vercel released Next.js 12 — the biggest release in years. The Rust-based compiler, Middleware, and React 18 support make each of these features a major milestone.

## Rust Compiler

Next.js 12 replaces Babel with SWC, delivering a dramatic improvement in compile speed:

```
基准测试（中型项目，约 200 个页面）：

Babel（Next.js 11）:  初始编译 ~35s，HMR ~800ms
SWC（Next.js 12）:    初始编译 ~5s，  HMR ~50ms

提升约 5-7 倍
```

For users, the upgrade is transparent — no config changes are needed, yet the developer experience improves noticeably. On top of that, SWC also takes over minification, replacing Terser:

```javascript
// next.config.js - 实际上不需要改任何配置
// SWC 会自动启用，作为 Babel 和 Terser 的替代
// 只有需要自定义 Babel 配置时才需要 babel.config.js
module.exports = {
  // 如果项目有 babel.config.js，SWC 会跳过，建议删除
  // 让 Next.js 尽可能使用 SWC
}
```

## Middleware

This is the biggest new feature in Next.js 12 — code that runs before a request reaches your page:

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

  // 认证检查
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('auth-token')
    if (!token) {
      return NextResponse.redirect('/login')
    }
  }

  // A/B 测试
  if (pathname === '/pricing') {
    const bucket = Math.random() < 0.5 ? 'a' : 'b'
    const response = NextResponse.next()
    response.cookies.set('ab-bucket', bucket)
    return response
  }

  return NextResponse.next()
}
```

Middleware runs on the Edge Runtime, which is lighter than Node.js and responds faster. It's well suited to lightweight logic such as authentication, redirects, and A/B testing.

## Image Optimization Enhancement

```jsx
import Image from 'next/image'

// 支持模糊占位符
<Image
  src="/hero.jpg"
  width={800}
  height={400}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQ..."
  alt="Hero"
/>

// 自定义图片加载器
// next.config.js
module.exports = {
  images: {
    loader: 'imgix', // 或 'cloudinary', 'akamai', 'custom'
    path: 'https://cdn.example.com/',
  }
}
```

## React 18 Support

Next.js 12 begins to support some of React 18's features:

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

Combined with React 18's streaming SSR, pages can render a skeleton first and progressively fill in content, reducing TTFB.

## URL Imports (Experimental)

You can import modules directly from a URL without installing them via npm:

```javascript
// 实验性特性，需要在 next.config.js 中启用
// next.config.js
module.exports = {
  experimental: {
    urlImports: ['https://esm.sh/']
  }
}

// 直接从 URL 导入
import confetti from 'https://esm.sh/canvas-confetti@1.4.0'

export default function Page() {
  return <button onClick={() => confetti()}>庆祝</button>
}
```

## Summary

- The SWC compiler speeds up builds 5–7× with zero-config upgrades
- Middleware is the most important new feature in Next.js 12, running on the Edge Runtime
- React 18's Suspense SSR support improves the page-loading experience
- Rust-ification is a trend in frontend tooling (SWC, esbuild, and Vite's esbuild-based pre-bundling)
- Next.js is evolving from a React framework into a full-stack development platform