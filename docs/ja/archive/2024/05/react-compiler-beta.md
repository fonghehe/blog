---
title: "React Compiler Beta：React Conf 2024 重大発表、useMemo からの解放"
date: 2024-05-15 16:44:58
tags:
  - React
readingTime: 3
description: "React Conf 2024 于 5 月 15-16 日举行，最重磅的消息是 **React Compiler Beta 正式发布**（此前代号 React Forget）。React 团队宣布 Instagram 已在生产环境使用 React Compiler 超过一年，并将其开源给社区使用。这可能是 React "
---

React Conf 2024 于 5 月 15-16 日举行，最重磅的消息是 **React Compiler Beta 正式发布**（此前代号 React Forget）。React 团队宣布 Instagram 已在生产环境使用 React Compiler 超过一年，并将其开源给社区使用。这可能是 React 近几年最具实质意义的更新。

## React Compiler 是什么

React Compiler はビルド時コンパイラーで、コンポーネントコードを分析し、開発者が手動でコードを記述することなく **`useMemo`、`useCallback`、`React.memo` に相当する最適化を自動的に挿入**します。

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

React Compiler Beta は Babel プラグインとして提供されます：

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

コンパイラーは React の 3 つのルールに基づいてコードを分析します：

1. **コンポーネントと Hook は冪等でなければならない**（同じ入力 → 同じ出力）
2. **Props と State は読み取り専用**（直接変更不可）
3. **Hook はトップレベルでのみ呼び出せる**（条件分岐やループ内は不可）

これらの 3 つのルールを満たすコードに対して、コンパイラーはメモ化の最適化を安全に挿入できます：

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

付属の ESLint プラグインで React のルールに準拠していないコードを事前に発見できます：

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

コンパイラーは全量採用を必要とせず、ファイルレベルの opt-in/opt-out をサポートします：

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

- **React 19 RC** 同時リリース（Actions、`use()` Hook、Server Actions が安定）
- **React Native New Architecture** がまもなくデフォルトになる予定
- **Server Components** が Expo Router で利用可能（React Native の RSC！）

## 結論

React Compiler Beta は React の最適化体験における大きな躍進です。Instagram の 1 年間の本番検証がコミュニティに信頼を与えました。新しいプロジェクトには今すぐ試用することをお勧めします。大規模な既存プロジェクトには、まず `eslint-plugin-react-compiler` でコードの健全性をスキャンし、段階的に有効化することをお勧めします。`useMemo` 地獄に別れを告げる時代が来ました。