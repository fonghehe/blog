---
title: "Next.js 12 新機能解説"
date: 2021-10-18 16:44:59
tags:
  - React
  - JavaScript

readingTime: 3
description: "Vercel は 2021 年 10 月に Next.js 12 をリリースした。ここ数年で最大のバージョンアップデートであり、Rust 製コンパイラ、Middleware、React 18 サポートといずれも重量級な機能ばかりだ。"
wordCount: 572
---

Vercel は 2021 年 10 月に Next.js 12 をリリースした。これはここ数年で最大のバージョンアップデートだ。Rust 製コンパイラ、Middleware、React 18 のサポートといずれも目玉となる大きな機能ばかりだ。

## Rust コンパイラ

Next.js 12 は Babel を SWC に置き換え、コンパイル速度が大幅に向上した：

```
基准测试（中型项目，约 200 个页面）：

Babel（Next.js 11）:  初始编译 ~35s，HMR ~800ms
SWC（Next.js 12）:    初始编译 ~5s，  HMR ~50ms

提升约 5-7 倍
```

ユーザーにとっては意識せずに済むアップグレードだ。設定ファイルを変更する必要はないが、開発体験は見た目に分かるほど良くなる。しかも SWC はコード圧縮も担い、Terser を置き換えた：

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

これは Next.js 12 最大の新機能で、リクエストがページに到達する前にコードを実行できる：

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

Middleware は Edge Runtime 上で動作し、Node.js より軽量で応答も速い。認証やリダイレクト、A/B テストといった軽量なロジックに向いている。

## 画像最適化の強化

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

Next.js 12 は React 18 の一部機能をサポートし始めた：

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

React 18 の Streaming SSR と組み合わせることで、ページはまずスケルトン画面を描画し、その後段階的にコンテンツを埋めていくため、TTFB を削減できる。

## URL インポート（実験的）

npm でインストールせずに、URL から直接モジュールをインポートできる：

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

## まとめ

- SWC コンパイラによりビルド速度が 5〜7 倍向上し、設定不要でアップグレードできる
- Middleware は Next.js 12 で最も重要な新機能であり、Edge Runtime 上で動作する
- React 18 の Suspense SSR サポートにより、ページの読み込み体験が向上する
- Rust 化はフロントエンドのツールチェーンのトレンドだ（SWC、esbuild、Vite の esbuild プリビルドなど）
- Next.js は React フレームワークからフルスタック開発プラットフォームへと進化している
