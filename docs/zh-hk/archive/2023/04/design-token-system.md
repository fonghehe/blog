---
title: "Design Token 系統：從 CSS 變量到多主題架構"
date: 2023-04-28 14:31:48
tags:
  - 前端
readingTime: 2
description: "作為組件系統負責人，設計 Token 是我們團隊今年的重點建設之一。分享一下從 0 到 1 搭建 Token 系統的經驗。"
wordCount: 294
---

作為組件系統負責人，設計 Token 是我們團隊今年的重點建設之一。分享一下從 0 到 1 搭建 Token 系統的經驗。

## 什麼是 Design Token

Design Token 是設計決策的最小單元。顏色、間距、圓角、字體——這些值不應該散落在 CSS 文件裏，而應該集中定義、統一管理。

```typescript
// tokens/colors.ts
export const colors = {
  // 基礎色板
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
  primary: {
    50: "#eff6ff",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
  },
} as const;
```

這還隻是原始值。真正有用的是語義化 Token：

```typescript
// tokens/semantic.ts
export const semanticColors = {
  light: {
    bg: {
      primary: colors.white,
      secondary: colors.gray[50],
      elevated: colors.white,
    },
    text: {
      primary: colors.gray[900],
      secondary: colors.gray[600],
      disabled: colors.gray[400],
    },
    border: {
      default: colors.gray[200],
      focus: colors.primary[500],
    },
  },
  dark: {
    bg: {
      primary: colors.gray[900],
      secondary: colors.gray[800],
      elevated: colors.gray[800],
    },
    text: {
      primary: colors.gray[50],
      secondary: colors.gray[400],
      disabled: colors.gray[600],
    },
    border: {
      default: colors.gray[700],
      focus: colors.primary[500],
    },
  },
};
```

## CSS 變量方案

```typescript
// 生成 CSS 變量
function generateCSSVars(theme: "light" | "dark") {
  const tokens = semanticColors[theme];
  const vars: Record<string, string> = {};

  function flatten(obj: Record<string, any>, prefix: string) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object") {
        flatten(value, `${prefix}-${key}`);
      } else {
        vars[`${prefix}-${key}`] = value;
      }
    }
  }

  flatten(tokens, "--color");
  return vars;
}
```

```css
/* 自動生成 */
:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-border-default: #e5e7eb;
}

[data-theme="dark"] {
  --color-bg-primary: #111827;
  --color-bg-secondary: #1f2937;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
  --color-border-default: #374151;
}
```

## 組件中使用

```tsx
// Button 組件
const Button = styled.button`
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--text-sm);

  &:hover {
    background: var(--color-bg-secondary);
  }

  &:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }
`;
```

切換主題隻需要改 `data-theme` 屬性，所有組件自動變色。不需要 JavaScript 重新渲染。

## 間距和排版 Token

```typescript
export const spacing = {
  0: "0",
  1: "0.25rem",  // 4px
  2: "0.5rem",   // 8px
  3: "0.75rem",  // 12px
  4: "1rem",     // 16px
  6: "1.5rem",   // 24px
  8: "2rem",     // 32px
  12: "3rem",    // 48px
  16: "4rem",    // 64px
} as const;

export const typography = {
  xs: { fontSize: "0.75rem", lineHeight: "1rem" },
  sm: { fontSize: "0.875rem", lineHeight: "1.25rem" },
  base: { fontSize: "1rem", lineHeight: "1.5rem" },
  lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
  xl: { fontSize: "1.25rem", lineHeight: "1.75rem" },
} as const;
```

## Token 工具鏈

```jsonc
// package.json
{
  "scripts": {
    "tokens:build": "style-dictionary build",
    "tokens:watch": "style-dictionary build --watch"
  }
}
```

用 Style Dictionary 從 Token 源檔案生成 CSS 變量、TypeScript 類型、iOS/Android 常量。一套源檔案，多平臺輸出。

## 小結

- Design Token 是設計系統的基礎設施，讓設計決策可編程
- 基礎色板 + 語義化 Token 的兩層結構兼顧靈活性和可維護性
- CSS 變量方案實現零 JS 開銷的主題切換
- 配合 Style Dictionary 實現 Token 的多平臺分發
- Token 系統的建設投入大，但在多主題、多品牌項目中收益明顯