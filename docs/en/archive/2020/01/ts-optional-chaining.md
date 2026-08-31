---
title: "TypeScript Optional Chaining and Nullish Coalescing in Practice"
date: 2020-01-07 16:46:58
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 3.7 introduced optional chaining and nullish coalescing, finally freeing us from long chains of `&&` checks. After using them in real projects for a while, here's a summary of usage scenarios and caveats."
wordCount: 156
---

TypeScript 3.7 introduced optional chaining and nullish coalescing, so we no longer have to write long chains of `&&` checks. After using them in real projects for a while, here's a summary of usage scenarios and caveats.

## What Problem Does Optional Chaining (?.) Solve

The most common case in daily development is accessing deeply nested object properties, which used to be written like this:

```typescript
// 以前：层层判断
const street = user && user.address && user.address.street;

// 或者用 lodash
import get from 'lodash/get';
const street = get(user, 'address.street');
```

With optional chaining, it's done in one line:

```typescript
// 可选链：简洁明了
const street = user?.address?.street;

// 方法调用也可选链
const result = user?.getAddress?.();

// 数组访问
const first = arr?.[0];
```

## Nullish Coalescing ??

The key difference from `||` is this: `||` treats `0`, `''`, and `false` as falsy too, while `??` only handles `null` and `undefined`.

```typescript
const count = 0;

// || 的问题：0 被当成假值
console.log(count || 10);  // 10 —— 不对！

// ?? 只看 null/undefined
console.log(count ?? 10);  // 0 —— 正确

// 典型场景：API 返回的默认值
interface Config {
  pageSize: number;
  theme: string;
}

function loadConfig(input: Partial<Config>): Config {
  return {
    pageSize: input.pageSize ?? 20,
    theme: input.theme ?? 'light',
  };
}
```

## Real-World Application

```typescript
// API 响应处理
interface ApiResponse {
  data?: {
    list?: Array<{
      id: number;
      name: string;
      avatar?: string;
    }>;
    total?: number;
  };
  code: number;
}

function renderUsers(res: ApiResponse) {
  const users = res.data?.list ?? [];
  const total = res.data?.total ?? 0;

  users.forEach(user => {
    // 头像兜底
    const avatar = user.avatar ?? '/default-avatar.png';
    console.log(`${user.name}: ${avatar}`);
  });

  return { users, total };
}

// 条件执行
function notify(message: string, callback?: (msg: string) => void) {
  callback?.(message);
}

// Vue 组件中的应用（配合 TypeScript）
// computed 里经常用
const userName = computed(() => {
  return store.state.user?.profile?.name ?? '未登录';
});
```

## Configuring TypeScript Support

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"]
  }
}
```

If the target browser doesn't support them, Babel will downlevel them:

```bash
npm install @babel/plugin-proposal-optional-chaining @babel/plugin-proposal-nullish-coalescing-operator -D
```

```json
// babel.config.json
{
  "plugins": [
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator"
  ]
}
```

## Summary

- Optional chaining `?.` makes deep property access safe and concise.
- Nullish coalescing `??` is more precise than `||` and won't misjudge `0`, `''`, or `false`.
- Used with TypeScript 3.7+, type inference follows correctly too.
- Watch out for compatibility—legacy projects need Babel plugins to downlevel.
