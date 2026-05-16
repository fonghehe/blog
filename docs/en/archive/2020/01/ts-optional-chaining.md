---
title: "TypeScript Optional Chaining and Nullish Coalescing in Practice"
date: 2020-01-07 16:46:58
tags:
  - TypeScript
readingTime: 1
description: "TypeScript 3.7 引入了可选链（Optional Chaining）和空值合并（Nullish Coalescing）这两个语法，终于不用再写一长串的 `&&` 判断了。在实际项目中用了一段时间，总结一下使用场景和注意事项。"
---

TypeScript 3.7 引入了可选链（Optional Chaining）和空值合并（Nullish Coalescing）这两个语法，终于不用再写一长串的 `&&` 判断了。在实际项目中用了一段时间，总结一下使用场景和注意事项。

## What Problem Does Optional Chaining ?. Solve

日常开发中最常见的就是访问深层嵌套对象属性，以前得这么写：

```typescript
// 以前：层层判断
const street = user && user.address && user.address.street;

// 或者用 lodash
import get from 'lodash/get';
const street = get(user, 'address.street');
```

有了可选链，一行搞定：

```typescript
// 可选链：简洁明了
const street = user?.address?.street;

// 方法调用也可选链
const result = user?.getAddress?.();

// 数组访问
const first = arr?.[0];
```

## Nullish Coalescing ??

和 `||` 的区别是关键：`||` 会把 `0`、`''`、`false` 也当作假值，`??` 只处理 `null` 和 `undefined`。

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

## 配置 TypeScript 支持

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"]
  }
}
```

如果目标浏览器不支持，Babel 会帮忙降级：

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

- 可选链 `?.` 让深层属性访问变得安全且简洁
- 空值合并 `??` 比 `||` 更精确，不会误判 `0`、`''`、`false`
- 配合 TypeScript 3.7+ 使用，类型推断也能正确跟随
- 注意兼容性，老项目需要 Babel 插件降级
