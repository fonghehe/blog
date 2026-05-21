---
title: "Next.js 12 新特性解析"
date: 2021-10-18 16:44:59
tags:
  - Next.js
  - JavaScript
readingTime: 2
description: "Vercel 在 2021 年 10 月发布了 Next.js 12，这是近年来最大的一次版本更新。Rust 编译器、Middleware、React 18 支持，每个特性都很重磅。"
wordCount: 334
---

Vercel 在 2021 年 10 月发布了 Next.js 12，这是近年来最大的一次版本更新。Rust 编译器、Middleware、React 18 支持，每个特性都很重磅。

## Rust 编译器

Next.js 12 用 SWC 替换了 Babel，编译速度提升显著：

```
基准测试（中型项目，约 200 个页面）：

Babel（Next.js 11）:  初始编译 ~35s，HMR ~800ms
SWC（Next.js 12）:    初始编译 ~5s，  HMR ~50ms

提升约 5-7 倍
```

对用户来说是无感的升级——配置文件不需要改，但开发体验肉眼变好了。而且 SWC 还承担了代码压缩的工作，替代了 Terser：

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

这是 Next.js 12 最大的新特性——在请求到达页面之前运行代码：

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

Middleware 运行在 Edge Runtime 上，比 Node.js 更轻量，响应更快。适合做认证、重定向、A/B 测试这类轻量逻辑。

## 图片优化增强

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

## React 18 支持

Next.js 12 开始支持 React 18 的部分特性：

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

配合 React 18 的 Streaming SSR，页面可以先渲染骨架屏，再逐步填充内容，减少 TTFB。

## URL 导入（实验性）

可以直接从 URL 导入模块，不需要 npm 安装：

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

## 小结

- SWC 编译器让构建速度提升 5-7 倍，无配置升级
- Middleware 是 Next.js 12 最重要的新特性，运行在 Edge Runtime
- React 18 的 Suspense SSR 支持让页面加载体验更好
- Rust 化是前端工具链的趋势（SWC、esbuild、Vite 的 esbuild 预构建）
- Next.js 正在从 React 框架演进为全栈开发平台