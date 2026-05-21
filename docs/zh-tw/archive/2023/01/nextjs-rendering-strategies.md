---
title: "Next.js Partial Prerendering 預覽"
date: 2023-01-23 09:48:06
tags:
  - Next.js
readingTime: 3
description: "Partial Prerendering (PPR) 是 Vercel 在 Next.js 14 中預覽的實驗性特性。它試圖解決一個長期矛盾：靜態頁面載入快但缺乏個性化，動態頁面個性化但首屏慢。PPR 的方案是在構建時生成靜態 shell，執行時動態填充內容。"
wordCount: 481
---

Partial Prerendering (PPR) 是 Vercel 在 Next.js 14 中預覽的實驗性特性。它試圖解決一個長期矛盾：靜態頁面載入快但缺乏個性化，動態頁面個性化但首屏慢。PPR 的方案是在構建時生成靜態 shell，執行時動態填充內容。

## 核心思想：靜態殼 + 動態插槽

傳統模式中，一個頁面要麼全部靜態（SSG），要麼全部動態（SSR）。PPR 允許同一個頁面中靜態和動態部分共存。

```tsx
// app/layout.tsx - 整個佈局可以是靜態的
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <header>
          <nav>
            <Link href="/">首頁</Link>
            <Link href="/blog">部落格</Link>
          </nav>
        </header>
        <main>{children}</main>
        {/* 這個 footer 是靜態的，構建時生成 */}
        <footer>
          <p>My Blog &copy; 2023</p>
        </footer>
      </body>
    </html>
  )
}
```

```tsx
// app/page.tsx - 混合靜態和動態內容
import { Suspense } from 'react'

// 靜態部分：構建時生成
function StaticHero() {
  return (
    <section>
      <h1>歡迎來到我的部落格</h1>
      <p>前端技術分享與思考</p>
    </section>
  )
}

// 動態部分：執行時獲取
async function PersonalizedRecommendations() {
  // 這個函式在請求時執行，可以訪問 cookie、headers 等
  const user = await getCurrentUser()
  const posts = await getRecommendedPosts(user.id)

  return (
    <section>
      <h2>為你推薦</h2>
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
      {/* Suspense 邊界標記了動態插槽的範圍 */}
      <Suspense fallback={<RecommendationSkeleton />}>
        <PersonalizedRecommendations />
      </Suspense>
    </div>
  )
}
}
```

在 PPR 模式下，`StaticHero` 部分在構建時就生成了 HTML 和 RSC Payload，只有 `PersonalizedRecommendations` 這個 Suspense 邊界內的內容在執行時流式填充。

## 與傳統流式渲染的區別

Next.js 13 已經支援流式渲染（Streaming SSR），PPR 是在流式渲染基礎上更進一步。

```tsx
// 傳統流式渲染：整個頁面都是動態的，只是渲染順序可以調整
export default async function Page() {
  // 整個頁面在執行時執行
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

// PPR 模式：靜態部分在構建時就確定了，不參與執行時渲染
// 靜態部分的 HTML 直接從 CDN 返回，TTFB 接近純靜態站點
// 動態部分通過 edge streaming 填充
export const experimental_ppr = true // 啟用 PPR

export default function Page() {
  return (
    <div>
      {/* 純靜態，構建時生成 */}
      <Header />
      <Navigation />

      {/* 動態插槽 */}
      <Suspense fallback={<UserDashboardSkeleton />}>
        <UserDashboard />
      </Suspense>

      {/* 純靜態 */}
      <Footer />
    </div>
  )
}
```

傳統流式渲染的 TTFB 取決於最慢的資料請求。PPR 的 TTFB 是純靜態的（CDN 快取命中的速度），動態內容非同步填充。

## 實際收益與限制

PPR 最大的收益是 TTFB 和 LCP 的改善，特別是對於大部分內容靜態、少部分個性化的頁面（如電商首頁、內容站點）。

```tsx
// 實際收益對比（概念性資料）
// 傳統 SSR:
// TTFB: 200ms (伺服器渲染)
// LCP:  800ms

// 傳統 SSG:
// TTFB: 50ms (CDN)
// LCP:  300ms
// 但: 無法個性化

// PPR:
// TTFB: 50ms (靜態殼從 CDN 返回)
// LCP:  350ms (靜態殼的 LCP 元素)
// 個性化內容: 非同步流式填充
```

限制也很明顯：PPR 要求頁面可以清晰地劃分為靜態和動態部分。如果整個頁面都是高度個性化的（如使用者後臺），PPR 收益有限。

## 小結

- PPR 的核心是"靜態殼 + 動態插槽"，同一頁面中靜態和動態內容共存
- 相比傳統 SSR，PPR 的 TTFB 接近純靜態站點，同時保留個性化能力
- 實現依賴 Suspense 邊界，邊界外是靜態的，邊界內是動態的
- 適合"大體靜態、區域性動態"的頁面模式，不適合全動態頁面
- 目前仍是實驗性特性，需要開啟 `experimental_ppr` 標誌，生產環境需謹慎評估