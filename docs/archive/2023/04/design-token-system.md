---
title: "Design Token 系统：从 CSS 变量到多主题架构"
date: 2023-04-28 14:31:48
tags:
  - 前端
readingTime: 2
description: "作为组件系统负责人，设计 Token 是我们团队今年的重点建设之一。分享一下从 0 到 1 搭建 Token 系统的经验。"
wordCount: 294
---

作为组件系统负责人，设计 Token 是我们团队今年的重点建设之一。分享一下从 0 到 1 搭建 Token 系统的经验。

## 什么是 Design Token

Design Token 是设计决策的最小单元。颜色、间距、圆角、字体——这些值不应该散落在 CSS 文件里，而应该集中定义、统一管理。

```typescript
// tokens/colors.ts
export const colors = {
  // 基础色板
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

这还只是原始值。真正有用的是语义化 Token：

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

## CSS 变量方案

```typescript
// 生成 CSS 变量
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
/* 自动生成 */
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

## 组件中使用

```tsx
// Button 组件
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

切换主题只需要改 `data-theme` 属性，所有组件自动变色。不需要 JavaScript 重新渲染。

## 间距和排版 Token

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

## Token 工具链

```jsonc
// package.json
{
  "scripts": {
    "tokens:build": "style-dictionary build",
    "tokens:watch": "style-dictionary build --watch"
  }
}
```

用 Style Dictionary 从 Token 源文件生成 CSS 变量、TypeScript 类型、iOS/Android 常量。一套源文件，多平台输出。

## 小结

- Design Token 是设计系统的基础设施，让设计决策可编程
- 基础色板 + 语义化 Token 的两层结构兼顾灵活性和可维护性
- CSS 变量方案实现零 JS 开销的主题切换
- 配合 Style Dictionary 实现 Token 的多平台分发
- Token 系统的建设投入大，但在多主题、多品牌项目中收益明显