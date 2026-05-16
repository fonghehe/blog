---
title: "React Compiler Beta: React Conf 2024 Major Release, Say Goodbye to useMemo"
date: 2024-05-15 16:44:58
tags:
  - React
readingTime: 2
description: "React Conf 2024 于 5 月 15-16 日举行，最重磅的消息是 **React Compiler Beta 正式发布**（此前代号 React Forget）。React 团队宣布 Instagram 已在生产环境使用 React Compiler 超过一年，并将其开源给社区使用。这可能是 React "
---

React Conf 2024 于 5 月 15-16 日举行，最重磅的消息是 **React Compiler Beta 正式发布**（此前代号 React Forget）。React 团队宣布 Instagram 已在生产环境使用 React Compiler 超过一年，并将其开源给社区使用。这可能是 React 近几年最具实质意义的更新。

## React Compiler 是什么

React Compiler is a build-time compiler that analyzes your component code and **automatically inserts the equivalent of `useMemo`, `useCallback`, and `React.memo`** optimizations, without requiring developers to write this code manually.

```tsx
// 你写的代码（无任何手动优化）：
function ProductList({ products, filter }) {
  const filtered = products.filter((p) => p.category === filter);

  function handleClick(id: string) {
    removeFromCart(id);
  }

  return filtered.map((p) => (
    <ProductCard key={p.id} product={p} onClick={handleClick} />
  ));
}

// React Compiler 生成的等价代码（概念示意）：
function ProductList({ products, filter }) {
  const filtered = useMemo(
    () => products.filter((p) => p.category === filter),
    [products, filter],
  );

  const handleClick = useCallback(
    (id: string) => {
      removeFromCart(id);
    },
    [
      /* 依赖自动分析 */
    ],
  );

  return filtered.map((p) => (
    <ProductCard key={p.id} product={p} onClick={handleClick} />
  ));
}
```

## 安装与配置

React Compiler Beta is provided as a Babel plugin:

```bash
npm install babel-plugin-react-compiler
# 或
npm install --save-dev babel-plugin-react-compiler
```

**Vite 项目**：

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
  ],
});
```

**Next.js 项目（实验性）**：

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
};

module.exports = nextConfig;
```

## React Compiler 的工作原理

The Compiler analyzes code based on React's three rules:

1. **Components and Hooks must be idempotent** (same input → same output)
2. **Props and State are read-only** (cannot be modified directly)
3. **Hooks can only be called at the top level** (not inside conditions or loops)

For code that satisfies these three rules, the Compiler can safely insert memoization optimizations:

```tsx
// ✅ 可以编译优化：纯函数式
function UserCard({ user }: { user: User }) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("");
  return (
    <div>
      {initials} - {user.email}
    </div>
  );
}

// ❌ Compiler 会跳过：直接修改参数（违反规则）
function BadComponent({ items }: { items: string[] }) {
  items.push("extra"); // 直接修改 prop！
  return (
    <ul>
      {items.map((i) => (
        <li>{i}</li>
      ))}
    </ul>
  );
}
```

## eslint-plugin-react-compiler

The accompanying ESLint plugin helps identify code that does not comply with React rules early:

```bash
npm install eslint-plugin-react-compiler
```

```javascript
// .eslintrc.js
module.exports = {
  plugins: ["react-compiler"],
  rules: {
    "react-compiler/react-compiler": "error",
  },
};
```

## 渐进式迁移

The Compiler does not require full adoption; it supports file-level opt-in/opt-out:

```tsx
// 整个文件 opt-out
"use no memo";

function LegacyComponent() {
  // 这个文件中的组件不会被 Compiler 优化
}

// 或者，标记特定函数 opt-out（未来计划）
// 目前用注释方式：
```

## React Conf 2024 其他亮点

- **React 19 RC** released simultaneously (Actions, `use()` Hook, Server Actions stable)
- **React Native New Architecture** is about to become the default
- **Server Components** available in Expo Router (RSC for React Native!)

## Conclusion

React Compiler Beta is a major leap forward in React's optimization experience. Instagram's one year of production validation has given the community confidence. For new projects, it's recommended to try it now; for large legacy projects, start by scanning code health with `eslint-plugin-react-compiler`, then gradually enable it. The era of saying goodbye to `useMemo` hell has arrived.