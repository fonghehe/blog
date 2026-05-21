---
title: "React Compiler Beta：React Conf 2024 重磅发布，彻底告别 useMemo"
date: 2024-05-15 16:44:58
tags:
  - React
readingTime: 2
description: "React Conf 2024 于 5 月 15-16 日举行，最重磅的消息是 **React Compiler Beta 正式发布**（此前代号 React Forget）。React 团队宣布 Instagram 已在生产环境使用 React Compiler 超过一年，并将其开源给社区使用。这可能是 React "
wordCount: 429
---

React Conf 2024 于 5 月 15-16 日举行，最重磅的消息是 **React Compiler Beta 正式发布**（此前代号 React Forget）。React 团队宣布 Instagram 已在生产环境使用 React Compiler 超过一年，并将其开源给社区使用。这可能是 React 近几年最具实质意义的更新。

## React Compiler 是什么

React Compiler 是一个构建时编译器，它分析你的组件代码，**自动插入 `useMemo`、`useCallback` 和 `React.memo`** 的等价优化，而无需开发者手动编写这些代码。

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

React Compiler Beta 以 Babel 插件形式提供：

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

Compiler 基于 React 的三条规则分析代码：

1. **组件和 Hook 必须是幂等的**（相同输入 → 相同输出）
2. **Props 和 State 是只读的**（不能直接修改）
3. **Hook 只能在顶层调用**（不能在条件或循环中）

满足这三条规则的代码，Compiler 可以安全地插入记忆化优化：

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

配套的 ESLint 插件可以提前发现不符合 React 规则的代码：

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

Compiler 不要求全量采用，支持文件级别的 opt-in/opt-out：

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

- **React 19 RC** 同步发布（Actions、`use()` Hook、Server Actions 稳定）
- **React Native New Architecture** 即将成为默认
- **Server Components** 在 Expo Router 中可用（React Native 的 RSC！）

## 总结

React Compiler Beta 是 React 优化体验的重大跃进。Instagram 一年的生产验证给了社区信心。对于新项目，建议现在就试用；对于大型老项目，可以先通过 `eslint-plugin-react-compiler` 扫描代码健康度，再逐步开启。告别 `useMemo` 地狱的时代来了。