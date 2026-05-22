---
title: "SvelteKit：Svelte のフルスタックフレームワーク"
date: 2022-09-06 15:28:09
tags:
  - Svelte
readingTime: 3
description: "Svelte 自体はすでに優れています——コンパイル時フレームワーク、ゼロランタイムオーバーヘッド、簡潔な構文。SvelteKit は Svelte に Next.js のようなフルスタックフレームワークをもたらします。ファイルルーティング、SSR/SSG、API routes。今こそ体験してみる時です。"
wordCount: 389
---

Svelte 自体はすでに優れています——コンパイル時フレームワーク、ゼロランタイムオーバーヘッド、簡潔な構文。SvelteKit は Svelte に Next.js のようなフルスタックフレームワークをもたらします：ファイルルーティング、SSR/SSG、API routes。今こそ体験する時です。

## 基本構造

```bash
pnpm create svelte@latest my-app
cd my-app
pnpm install
pnpm dev
```

プロジェクト構造：

```
my-app/
├── src/
│   ├── routes/
│   │   ├── +page.svelte      # ページコンポーネント
│   │   ├── +page.server.ts   # サーバーサイドデータ読み込み
│   │   ├── +layout.svelte    # レイアウト
│   │   └── +server.ts        # API ルート
│   └── lib/
│       └── components/
├── static/
└── svelte.config.js
```

## ページとルーティング

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<h1>文章列表</h1>

{#each data.posts as post}
  <article>
    <a href="/posts/{post.slug}">
      <h2>{post.title}</h2>
      <time>{post.date}</time>
    </a>
  </article>
{/each}
```

```typescript
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch('/api/posts');
  const posts = await res.json();

  return { posts };
};
```

## 動的ルーティング

```svelte
<!-- src/routes/posts/[slug]/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<article>
  <h1>{data.post.title}</h1>
  {@html data.post.content}
</article>
```

```typescript
// src/routes/posts/[slug]/+page.server.ts
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, fetch }) => {
  const res = await fetch(`/api/posts/${params.slug}`);

  if (!res.ok) {
    throw error(404, '文章不存在');
  }

  const post = await res.json();
  return { post };
};
```

## API ルート

```typescript
// src/routes/api/posts/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  const page = Number(url.searchParams.get('page') || '1');
  const limit = 10;

  const posts = await db.posts.findMany({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return json(posts);
};

export const POST: RequestHandler = async ({ request }) => {
  const data = await request.json();

  const post = await db.posts.create({
    data: {
      title: data.title,
      content: data.content,
      slug: slugify(data.title),
    },
  });

  return json(post, { status: 201 });
};
```

## フォームアクション

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import type { ActionData } from './$types';

  export let form: ActionData;
</script>

<form method="POST" action="?/login">
  <label>
    邮箱
    <input name="email" type="email" required />
  </label>

  <label>
    密码
    <input name="password" type="password" required />
  </label>

  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}

  <button type="submit">登录</button>
</form>
```

```typescript
// src/routes/login/+page.server.ts
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email') as string;
    const password = data.get('password') as string;

    const user = await authenticate(email, password);

    if (!user) {
      return fail(401, { error: '邮箱或密码错误' });
    }

    cookies.set('session', user.token, { path: '/' });
    throw redirect(303, '/dashboard');
  },
};
```

## リアクティビティ

Svelte のリアクティビティはコンパイル時です：

```svelte
<script lang="ts">
  let count = 0;
  let doubled = 0;

  // Svelte の $: は宣言的リアクティビティ
  $: doubled = count * 2;

  // リアクティブステートメント
  $: if (count > 10) {
    alert('超过 10 了！');
    count = 0;
  }

  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  点击了 {count} 次（双倍: {doubled}）
</button>
```

## コンパイル出力の比較

| フレームワーク | Hello World サイズ | ランタイム |
|------|------------------|--------|
| React 18 | 42KB | 仮想DOMあり |
| Vue 3 | 33KB | リアクティブランタイムあり |
| Svelte | 2KB | ゼロランタイム |

## まとめ

SvelteKit はコンテンツ型Webサイトや中小規模のアプリケーションに適しています。Svelte のコンパイル時の優位性はバンドルサイズにおいて非常に顕著です。フルスタック機能、ファイルルーティング、フォームActionsはすべて実用的です。しかし、エコシステムとコミュニティは React/Next.js には及ばず、大規模プロジェクトではサードパーティライブラリの可用性を評価する必要があります。