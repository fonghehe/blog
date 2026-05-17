---
title: "Next.js Partial Prerendering プレビュー"
date: 2023-01-23 09:48:06
tags:
  - Next.js
readingTime: 3
description: "Partial Prerendering (PPR) 是 Vercel 在 Next.js 14 中预览的实验性特性。它试图解决一个长期矛盾：静态页面加载快但缺乏个性化，动态页面个性化但首屏慢。PPR 的方案是在构建时生成静态 shell，运行时动态填充内容。"
---

Partial Prerendering (PPR) 是 Vercel 在 Next.js 14 中预览的实验性特性。它试图解决一个长期矛盾：静态页面加载快但缺乏个性化，动态页面个性化但首屏慢。PPR 的方案是在构建时生成静态 shell，运行时动态填充内容。

## コアコンセプト：静的シェル + 動的スロット

传统模式中，一个页面要么全部静态（SSG），要么全部动态（SSR）。PPR 允许同一个页面中静态和动态部分共存。

```tsx
// app/layout.tsx - 整个布局可以是静态的
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <header>
          <nav>
            <Link href="/">首页</Link>
            <Link href="/blog">博客</Link>
          </nav>
        </header>
        <main>{children}</main>
        {/* 这个 footer 是静态的，构建时生成 */}
        <footer>
          <p>My Blog &copy; 2023</p>
        </footer>
      </body>
    </html>
  )
}
```

```tsx
// app/page.tsx - 混合静态和动态内容
import { Suspense } from 'react'

// 静态部分：构建时生成
function StaticHero() {
  return (
    <section>
      <h1>欢迎来到我的博客</h1>
      <p>前端技术分享与思考</p>
    </section>
  )
}

// 动态部分：运行时获取
async function PersonalizedRecommendations() {
  // 这个函数在请求时执行，可以访问 cookie、headers 等
  const user = await getCurrentUser()
  const posts = await getRecommendedPosts(user.id)

  return (
    <section>
      <h2>为你推荐</h2>
      {posts.map(post => (
        <article key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </section>
  )
}

export default function HomePage() {
  return (
    <div>
      <StaticHero />
      {/* Suspense 边界标记了动态插槽的范围 */}
      <Suspense fallback={<RecommendationSkeleton />}>
        <PersonalizedRecommendations />
      </Suspense>
    </div>
  )
}
}
```

在 PPR 模式下，`StaticHero` 部分在构建时就生成了 HTML 和 RSC Payload，只有 `PersonalizedRecommendations` 这个 Suspense 边界内的内容在运行时流式填充。

## 従来のストリーミングレンダリングとの違い

Next.js 13 已经支持流式渲染（Streaming SSR），PPR 是在流式渲染基础上更进一步。

```tsx
// 传统流式渲染：整个页面都是动态的，只是渲染顺序可以调整
export default async function Page() {
  // 整个页面在运行时执行
  const header = await getHeader()       // 快
  const content = await getContent()     // 慢
  const sidebar = await getSidebar()     // 中等

  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header data={header} />
      </Suspense>
      <Suspense fallback={<ContentSkeleton />}>
        <Content data={content} />
      </Suspense>
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar data={sidebar} />
      </Suspense>
    </div>
  )
}

// PPR 模式：静态部分在构建时就确定了，不参与运行时渲染
// 静态部分的 HTML 直接从 CDN 返回，TTFB 接近纯静态站点
// 动态部分通过 edge streaming 填充
export const experimental_ppr = true // 启用 PPR

export default function Page() {
  return (
    <div>
      {/* 纯静态，构建时生成 */}
      <Header />
      <Navigation />

      {/* 动态插槽 */}
      <Suspense fallback={<UserDashboardSkeleton />}>
        <UserDashboard />
      </Suspense>

      {/* 纯静态 */}
      <Footer />
    </div>
  )
}
```

传统流式渲染的 TTFB 取决于最慢的数据请求。PPR 的 TTFB 是纯静态的（CDN 缓存命中的速度），动态内容异步填充。

## 実際のメリットと制限

PPR 最大的收益是 TTFB 和 LCP 的改善，特别是对于大部分内容静态、少部分个性化的页面（如电商首页、内容站点）。

```tsx
// 实际收益对比（概念性数据）
// 传统 SSR:
// TTFB: 200ms (服务器渲染)
// LCP:  800ms

// 传统 SSG:
// TTFB: 50ms (CDN)
// LCP:  300ms
// 但: 无法个性化

// PPR:
// TTFB: 50ms (静态壳从 CDN 返回)
// LCP:  350ms (静态壳的 LCP 元素)
// 个性化内容: 异步流式填充
```

限制也很明显：PPR 要求页面可以清晰地划分为静态和动态部分。如果整个页面都是高度个性化的（如用户后台），PPR 收益有限。

## まとめ

- PPR 的核心是"静态壳 + 动态插槽"，同一页面中静态和动态内容共存
- 相比传统 SSR，PPR 的 TTFB 接近纯静态站点，同时保留个性化能力
- 实现依赖 Suspense 边界，边界外是静态的，边界内是动态的
- 适合"大体静态、局部动态"的页面模式，不适合全动态页面
- 目前仍是实验性特性，需要开启 `experimental_ppr` 标志，生产环境需谨慎评估