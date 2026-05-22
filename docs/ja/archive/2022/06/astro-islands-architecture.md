---
title: "Astro 1.0：コンテンツファーストのフロントエンドフレームワーク"
date: 2022-06-07 15:28:54
tags:
  - フロントエンド
readingTime: 3
description: "Astro 1.0 が正式にリリースされました。その核となる理念は明確です。デフォルトではゼロ JavaScript を出力し、インタラクションが必要な箇所でのみ JS を読み込みます。コンテンツ型サイト（ブログ、ドキュメント、マーケティングページ）にとって、この方式は React/Vue のオールインワンよりはるかに効率的です。"
wordCount: 613
---

Astro 1.0 が正式にリリースされました。その核となる理念は明確です：デフォルトで JavaScript をゼロ出力し、インタラクションが必要な場所でのみ JS を読み込みます。コンテンツ型サイト（ブログ、ドキュメント、マーケティングページ）にとって、このアプローチは React/Vue のオールインワンよりはるかに効率的です。

## 核心理念：Islands Architecture

```
┌─────────────────────────────┐
│     静的 HTML（JS ゼロ）      │
│  ┌─────────┐  ┌──────────┐  │
│  │ Island  │  │ Island   │  │
│  │ (React) │  │ (Vue)    │  │
│  │ client: │  │ client:  │  │
│  │ load    │  │ visible  │  │
│  └─────────┘  └──────────┘  │
│     静的 HTML（JS ゼロ）      │
└─────────────────────────────┘
```

ページの大部分は静的 HTML で、「Island」としてマークされたコンポーネントのみが JS を読み込み、インタラクティブになります。

## クイックスタート

```bash
pnpm create astro@latest my-site
cd my-site
pnpm install
pnpm dev
```

## Astro コンポーネントの構文

```astro
---
// --- の間はサーバーサイドコード（ビルド時に実行）
import Layout from '../layouts/Layout.astro';
import Header from '../components/Header.astro';
import CommentWidget from '../components/CommentWidget';

const posts = await fetch('https://api.example.com/posts')
  .then(r => r.json());

const title = '我的技术博客';
---

<Layout title={title}>
  <Header />

  <main>
    {posts.map(post => (
      <article>
        <h2>{post.title}</h2>
        <p>{post.excerpt}</p>
        <time>{new Date(post.date).toLocaleDateString('zh-CN')}</time>
      </article>
    ))}
  </main>

  <!-- このコンポーネントはクライアント側で JS を読み込みます -->
  <CommentWidget client:load />
</Layout>
```

## Client Directives：JS をいつ読み込むかを制御

```astro
---
import ChatWidget from '../components/ChatWidget';
import Sidebar from '../components/Sidebar';
import Video from '../components/Video';
import Search from '../components/Search';
---

<!-- ページ読み込み後すぐに hydrate -->
<ChatWidget client:load />

<!-- コンポーネントがビューポートに入ってから hydrate（遅延ロード）-->
<Sidebar client:visible />

<!-- アイドル時に hydrate（requestIdleCallback）-->
<Search client:idle />

<!-- 特定のメディアクエリにマッチした場合のみ hydrate -->
<Video client:media="(max-width: 768px)" />

<!-- クライアント側のみレンダリング（SSR 時はレンダリングしない）-->
<HeavyChart client:only="react" />
```

## ハイブリッドフレームワーク

Astro は同じプロジェクト内で異なるフレームワークを混在させることをサポートしています：

```astro
---
import ReactHeader from '../components/Header.tsx';
import VueCard from '../components/Card.vue';
import SvelteFooter from '../components/Footer.svelte';
import SolidSidebar from '../components/Sidebar.tsx';
---

<ReactHeader client:load />
<VueCard />
<SvelteFooter />
<SolidSidebar client:visible />
```

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import solid from '@astrojs/solid-js';

export default defineConfig({
  integrations: [react(), vue(), svelte(), solid()],
});
```

これはマイクロフロントエンドのシナリオや段階的な移行で役立ちます。

## コンテンツコレクション（Content Collections）

Astro 1.0 のキラーフィーチャー：TypeScript の型安全な方法で Markdown コンテンツを管理します。

```typescript
// src/content/config.ts
import { z, defineCollection } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.string(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

```astro
---
import { getCollection } from 'astro:content';

// 型安全！frontmatter がスキーマに一致しない場合、ビルド時にエラー
const posts = await getCollection('blog', ({ data }) => {
  return !data.draft;
});

// 日付でソート
const sorted = posts.sort(
  (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
);
---

{sorted.map(post => (
  <a href={`/blog/${post.slug}`}>
    <h2>{post.data.title}</h2>
    <time>{post.data.date}</time>
  </a>
))}
```

## ビルド出力

```typescript
// astro.config.mjs
export default defineConfig({
  // 静的サイト（デフォルト）
  output: 'static',

  // または SSR モード
  // output: 'server',
  // adapter: vercel(),
});
```

静的ビルドの出力は純粋な HTML + CSS + ごくわずかな JS です。私たちのブログプロジェクトでは、ビルド後のトップページの JS サイズはわずか 2KB でした（React 製の検索コンポーネント）。

## パフォーマンス比較

同じブログプロジェクトを異なる構成で Lighthouse スコアを比較：

| フレームワーク | Performance | JS サイズ |
|------|-------------|---------|
| Next.js (SSG) | 78 | 180KB |
| Gatsby | 72 | 220KB |
| Astro | 98 | 2KB |

## まとめ

Astro は React/Vue を置き換えるものではなく、空白を埋めるものです：コンテンツ型サイトには SPA の複雑さは必要ありません。デフォルトで JS ゼロ、Islands Architecture、ハイブリッドフレームワークのサポート——これらの特性により、ドキュメントサイトやブログの最良の選択肢となっています。
