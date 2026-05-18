---
title: "React Compiler Beta：React Conf 2024 重磅釋出，徹底告別 useMemo"
date: 2024-05-15 16:44:58
tags:
  - React
readingTime: 2
description: "React Conf 2024 於 5 月 15-16 日舉行，最重磅的訊息是 **React Compiler Beta 正式釋出**（此前代號 React Forget）。React 團隊宣佈 Instagram 已在生產環境使用 React Compiler 超過一年，並將其開源給社群使用。這可能是 React "
---

React Conf 2024 於 5 月 15-16 日舉行，最重磅的訊息是 **React Compiler Beta 正式釋出**（此前代號 React Forget）。React 團隊宣佈 Instagram 已在生產環境使用 React Compiler 超過一年，並將其開源給社群使用。這可能是 React 近幾年最具實質意義的更新。

## React Compiler 是什麼

React Compiler 是一個構建時編譯器，它分析你的元件程式碼，**自動插入 `useMemo`、`useCallback` 和 `React.memo`** 的等價最佳化，而無需開發者手動編寫這些程式碼。

```tsx
// 你寫的程式碼（無任何手動最佳化）：
function ProductList({ products, filter }) {
  const filtered = products.filter((p) => p.category === filter);

  function handleClick(id: string) {
    removeFromCart(id);
  }

  return filtered.map((p) => (
    <ProductCard key={p.id} product={p} onClick={handleClick} />
  ));
}

// React Compiler 生成的等價程式碼（概念示意）：
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
      /* 依賴自動分析 */
    ],
  );

  return filtered.map((p) => (
    <ProductCard key={p.id} product={p} onClick={handleClick} />
  ));
}
```

## 安裝與配置

React Compiler Beta 以 Babel 外掛形式提供：

```bash
npm install babel-plugin-react-compiler
# 或
npm install --save-dev babel-plugin-react-compiler
```

**Vite 專案**：

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

**Next.js 專案（實驗性）**：

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

Compiler 基於 React 的三條規則分析程式碼：

1. **元件和 Hook 必須是冪等的**（相同輸入 → 相同輸出）
2. **Props 和 State 是隻讀的**（不能直接修改）
3. **Hook 只能在頂層呼叫**（不能在條件或迴圈中）

滿足這三條規則的程式碼，Compiler 可以安全地插入記憶化最佳化：

```tsx
// ✅ 可以編譯最佳化：純函式式
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

// ❌ Compiler 會跳過：直接修改引數（違反規則）
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

配套的 ESLint 外掛可以提前發現不符合 React 規則的程式碼：

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

## 漸進式遷移

Compiler 不要求全量採用，支援檔案級別的 opt-in/opt-out：

```tsx
// 整個檔案 opt-out
"use no memo";

function LegacyComponent() {
  // 這個檔案中的元件不會被 Compiler 最佳化
}

// 或者，標記特定函式 opt-out（未來計劃）
// 目前用註釋方式：
```

## React Conf 2024 其他亮點

- **React 19 RC** 同步釋出（Actions、`use()` Hook、Server Actions 穩定）
- **React Native New Architecture** 即將成為預設
- **Server Components** 在 Expo Router 中可用（React Native 的 RSC！）

## 總結

React Compiler Beta 是 React 最佳化體驗的重大躍進。Instagram 一年的生產驗證給了社群信心。對於新專案，建議現在就試用；對於大型老專案，可以先通過 `eslint-plugin-react-compiler` 掃描程式碼健康度，再逐步開啟。告別 `useMemo` 地獄的時代來了。