---
title: "SvelteKit: The Full-Stack Framework for Svelte"
date: 2022-09-06 15:28:09
tags:
  - Svelte
readingTime: 2
description: "Svelte itself is already impressive — a compile-time framework with zero runtime overhead and clean syntax. SvelteKit gives Svelte a Next.js-like full-stack framework: file-based routing, SSR/SSG, and API routes. Time to give it a try."
wordCount: 128
---

Svelte itself is already impressive — a compile-time framework with zero runtime overhead and clean syntax. SvelteKit gives Svelte a Next.js-like full-stack framework: file-based routing, SSR/SSG, and API routes. Time to give it a try.

## Basic Structure

```bash
pnpm create svelte@latest my-app
cd my-app
pnpm install
pnpm dev
```

Project structure:

```
my-app/
├── src/
│   ├── routes/
│   │   ├── +page.svelte      # 页面组件
│   │   ├── +page.server.ts   # 服务端数据加载
│   │   ├── +layout.svelte    # 布局
│   │   └── +server.ts        # API 路由
│   └── lib/
│       └── components/
├── static/
└── svelte.config.js
```

## Pages and Routing

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

## Dynamic Routes

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

## Form Actions

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

## Reactivity

Svelte's reactivity is compile-time:

```svelte
<script lang="ts">
  let count = 0;
  let doubled = 0;

  // Svelte 的 $: 是声明式响应式
  $: doubled = count * 2;

  // 响应式语句
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

## Compiled Output Comparison

| Framework | Hello World size | Runtime |
|------|------------------|--------|
| React 18 | 42KB | 有虚拟 DOM |
| Vue 3 | 33KB | Reactive runtime |
| Svelte | 2KB | Zero runtime |

## Summary

SvelteKit is well-suited for content-driven websites and small-to-medium applications. Svelte's compile-time advantages are clearly reflected in bundle size. Its full-stack capabilities, file-based routing, and form Actions are all very practical. However, its ecosystem and community are far behind React/Next.js, so for larger projects you'll need to evaluate third-party library availability.