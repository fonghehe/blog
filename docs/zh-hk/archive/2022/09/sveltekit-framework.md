---
title: "SvelteKit：Svelte 的全棧框架"
date: 2022-09-06 15:28:09
tags:
  - Svelte
readingTime: 2
description: "Svelte 本身已經很出色了——編譯時框架、零運行時開銷、簡潔的語法。SvelteKit 給了 Svelte 一個類似 Next.js 的全棧框架：檔案路由、SSR/SSG、API routes。是時候體驗一下了。"
wordCount: 202
---

Svelte 本身已經很出色了——編譯時框架、零運行時開銷、簡潔的語法。SvelteKit 給了 Svelte 一個類似 Next.js 的全棧框架：檔案路由、SSR/SSG、API routes。是時候體驗一下了。

## 基本結構

```bash
pnpm create svelte@latest my-app
cd my-app
pnpm install
pnpm dev
```

項目結構：

```
my-app/
├── src/
│   ├── routes/
│   │   ├── +page.svelte      # 頁面組件
│   │   ├── +page.server.ts   # 服務端數據加載
│   │   ├── +layout.svelte    # 佈局
│   │   └── +server.ts        # API 路由
│   └── lib/
│       └── components/
├── static/
└── svelte.config.js
```

## 頁面與路由

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

## 動態路由

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

## API Routes

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

## 表單 Actions

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import type { ActionData } from './$types';

  export let form: ActionData;
</script>

<form method="POST" action="?/login">
  <label>
    郵箱
    <input name="email" type="email" required />
  </label>

  <label>
    密碼
    <input name="password" type="password" required />
  </label>

  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}

  <button type="submit">登錄</button>
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
      return fail(401, { error: '郵箱或密碼錯誤' });
    }

    cookies.set('session', user.token, { path: '/' });
    throw redirect(303, '/dashboard');
  },
};
```

## 響應式

Svelte 的響應式是編譯時的：

```svelte
<script lang="ts">
  let count = 0;
  let doubled = 0;

  // Svelte 的 $: 是聲明式響應式
  $: doubled = count * 2;

  // 響應式語句
  $: if (count > 10) {
    alert('超過 10 了！');
    count = 0;
  }

  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  點擊了 {count} 次（雙倍: {doubled}）
</button>
```

## 編譯產物對比

| 框架 | Hello World 體積 | 運行時 |
|
------|------------------|--------|
| React 18 | 42KB | 有虛擬 DOM |
| Vue 3 | 33KB | 有響應式運行時 |
| Svelte | 2KB | 零運行時 |

## 小結

SvelteKit 適合內容型網站和中小型應用。Svelte 的編譯時優勢在 bundle size 上非常明顯。全棧能力、檔案路由、表單 Actions 都很實用。但生態和社區遠不如 React/Next.js，大型項目需要評估第三方庫的可用性。