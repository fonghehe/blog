---
title: "Astro 4：コンテンツファーストアーキテクチャの成熟"
date: 2024-01-15 16:44:54
tags:
  - フロントエンド
readingTime: 3
description: "Astro 4 がリリースされました。1年以上 Astro でコンテンツサイトを構築してきた経験から、なぜ特定のタイプのプロジェクトに適しているのか、そして実際のエンジニアリング体験について紹介します。"
wordCount: 581
---

Astro 4 がリリースされました。1年あまり Astro を使ってコンテンツサイトを運営してきた経験から、なぜ特定のプロジェクトに適しているのか、そして実際のエンジニアリング体験についてお話しします。

## Astroがコンテンツサイトに適している理由

Astro の核となる考え方：**デフォルトで JS ゼロ、オンデマンドでハイドレーション**。

```
React/Vue/Next.js の考え方：JS 優先
  - JS をダウンロード → JS を実行 → HTML をレンダリング

Astro の考え方：HTML 優先
  - サーバーサイドで HTML をレンダリング → ブラウザに送信（JS の負荷なし）
  - client:* とマークされたコンポーネントのみ JS をダウンロード
```

ブログ、ドキュメント、マーケティングページにとって、これは正しい優先順位です。

## Astroプロジェクト構造

```
src/
├── pages/
│   ├── index.astro          ← ホームページ
│   ├── blog/
│   │   ├── index.astro      ← ブログ一覧
│   │   └── [slug].astro     ← ブログ詳細
│   └── about.astro
├── layouts/
│   └── BlogPost.astro
├── components/
│   ├── Header.astro         ← Astro コンポーネント（純粋な HTML）
│   └── CommentSection.tsx   ← React コンポーネント（インタラクティブ）
└── content/
    └── blog/
        ├── hello-world.md
        └── second-post.mdx
```

## Astroコンポーネント構文

```astro
---
// ここはサーバーサイドで実行される JS（frontmatter）
import BlogCard from '../components/BlogCard.astro'
import { getCollection } from 'astro:content'

const posts = await getCollection('blog')
const sortedPosts = posts.sort((a, b) =>
  b.data.publishDate.getTime() - a.data.publishDate.getTime()
)
---

<!-- ここは HTML テンプレート -->
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>我的博客</title>
</head>
<body>
  <h1>文章列表</h1>

  {sortedPosts.map(post => (
    <BlogCard post={post} />
  ))}
</body>
</html>
```

## コンテンツコレクション

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    publishDate: z.date(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
  }),
});

export const collections = { blog };
```

```markdown
---
title: "React 19 新特性"
publishDate: 2024-05-01
tags: ["react", "前端"]
draft: false
---

文章内容...
```

```astro
---
// [slug].astro
import { getCollection, getEntry } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post }
  }))
}

const { post } = Astro.props
const { Content } = await post.render()
---

<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

## Islandsアーキテクチャ：オンデマンドハイドレーション

```astro
---
import ReactCounter from '../components/Counter.tsx'
import VueSearchBox from '../components/Search.vue'
---

<!-- 純粋な表示：JS をダウンロードしない -->
<Header />

<!-- インタラクションが必要：オンデマンドハイドレーション -->
<!-- client:load：ページ読み込み時にハイドレーション -->
<ReactCounter client:load />

<!-- client:idle：ブラウザがアイドル状態のときにハイドレーション -->
<VueSearchBox client:idle />

<!-- client:visible：ビューポートに入ったときにハイドレーション -->
<LazyChart client:visible />

<!-- client:only="react"：クライアント側のみでレンダリング、SSR なし -->
<RealTimeData client:only="react" />
```

## Astro 4 新機能

**Dev Toolbar**：開発時に使える UI デバッグツール、Next.js の dev ツールに類似

**View Transitions API の統合**：

```astro
---
import { ViewTransitions } from 'astro:transitions'
---

<head>
  <ViewTransitions />  <!-- ページ遷移アニメーションを有効化（MPA でも可能！）-->
</head>
```

**Server Islands**：サーバーサイドの動的コンテンツ + クライアントの静的コンテンツを混合

## Astroが適したシーン

- ✅ ブログ、ドキュメント、マーケティングページ
- ✅ コンテンツ中心で、少量のインタラクション
- ✅ 極限の Lighthouse スコアが必要
- ❌ 複雑なインタラクション（Next.js/Nuxt.js を使用）
- ❌ リアルタイムデータが必要（フルスタックフレームワークを使用）

## まとめ

- Astro はデフォルトで JS ゼロ、Next.js よりもコンテンツサイトに適しています
- Islands アーキテクチャ：インタラクションが必要なコンポーネントだけがハイドレーションされます
- コンテンツコレクション + 型チェックは、手書きの `import.meta.glob` よりはるかにエレガントです
- View Transitions API により、MPA でもスムーズなページ遷移が可能になります
- 2024年は Astro エコシステムが成熟する年であり、真剣に学ぶ価値があります
