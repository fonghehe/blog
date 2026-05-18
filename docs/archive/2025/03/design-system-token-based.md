---
title: "设计系统建设：从组件库到设计 Token"
date: 2025-03-15 10:00:00
tags:
  - 前端
readingTime: 3
description: "过去一年，我们团队建了一套设计系统。不是买了个 UI 组件库就叫设计系统，而是从零建设的。整理一下这个过程。"
---

过去一年，我们团队建了一套设计系统。不是买了个 UI 组件库就叫设计系统，而是从零建设的。整理一下这个过程。

## 为什么需要设计系统

症状：

- 不同页面的按钮样式不一致（圆角 4px、6px、8px 都有）
- 相同的颜色在代码里用了五种不同写法（`#3B82F6`、`blue-500`、`primary`、`brand`...）
- 设计稿改了颜色，需要在代码里全局搜索
- 新人入职不知道该用哪个组件

设计系统解决的核心问题：**单一事实来源（Single Source of Truth）**。

## 第一步：建立设计 Token

```
设计 Token = 将设计决策命名化

不是：#3B82F6（没有语义）
而是：color.brand.primary = #3B82F6（有语义）
```

```json
// tokens/colors.json（使用 Style Dictionary 格式）
{
  "color": {
    "brand": {
      "primary": { "value": "#3B82F6" },
      "primary-dark": { "value": "#1D4ED8" },
      "primary-light": { "value": "#DBEAFE" }
    },
    "neutral": {
      "900": { "value": "#111827" },
      "700": { "value": "#374151" },
      "500": { "value": "#6B7280" },
      "300": { "value": "#D1D5DB" },
      "100": { "value": "#F3F4F6" }
    },
    "semantic": {
      "success": { "value": "{color.green.500}" },
      "error": { "value": "{color.red.500}" },
      "warning": { "value": "{color.amber.500}" }
    }
  },
  "spacing": {
    "1": { "value": "4px" },
    "2": { "value": "8px" },
    "4": { "value": "16px" },
    "6": { "value": "24px" },
    "8": { "value": "32px" }
  }
}
```

## 用 Style Dictionary 生成代码

```javascript
// style-dictionary.config.js
const StyleDictionary = require("style-dictionary");

module.exports = {
  source: ["tokens/**/*.json"],
  platforms: {
    // 生成 CSS 变量
    css: {
      transformGroup: "css",
      prefix: "ds",
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.css",
          format: "css/variables",
        },
      ],
    },
    // 生成 JS 对象（给 Tailwind 用）
    js: {
      transformGroup: "js",
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.js",
          format: "javascript/module",
        },
      ],
    },
    // 生成 TypeScript 类型
    ts: {
      transformGroup: "js",
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.d.ts",
          format: "typescript/module-declarations",
        },
      ],
    },
  },
};
```

生成的 CSS：

```css
:root {
  --ds-color-brand-primary: #3b82f6;
  --ds-color-brand-primary-dark: #1d4ed8;
  --ds-color-neutral-900: #111827;
  --ds-spacing-4: 16px;
}
```

## Figma 变量同步

2024 年 Figma 推出了变量 API，可以和代码 token 双向同步：

```javascript
// scripts/sync-figma-tokens.js
const { FigmaAPI } = require("@figma/rest-api-spec");

async function syncToFigma(tokens) {
  const api = new FigmaAPI({ personalAccessToken: process.env.FIGMA_TOKEN });

  // 读取当前 Figma 变量
  const { variables } = await api.getLocalVariables(FILE_KEY);

  // 对比差异，更新
  for (const [name, value] of Object.entries(tokens)) {
    const existing = variables.find((v) => v.name === name);
    if (
      existing?.resolvedType === "COLOR" &&
      existing.valuesByMode["mode-id"] !== value
    ) {
      await api.updateVariable(FILE_KEY, existing.id, {
        valuesByMode: { "mode-id": value },
      });
    }
  }
}
```

实际效果：设计师改了颜色 → 跑同步脚本 → 代码自动更新。

## 组件层：不同于第三方组件库的思路

```tsx
// 我们的 Button 不是功能全面的通用组件
// 而是封装了我们的设计决策

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        // 基础样式
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        // variant
        {
          "bg-[var(--ds-color-brand-primary)] text-white hover:bg-[var(--ds-color-brand-primary-dark)]":
            variant === "primary",
          "border border-[var(--ds-color-neutral-300)] bg-white hover:bg-[var(--ds-color-neutral-100)]":
            variant === "secondary",
        },
        // size
        {
          "h-8 px-3 text-sm": size === "sm",
          "h-10 px-4 text-sm": size === "md",
          "h-12 px-6": size === "lg",
        },
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="mr-2 h-4 w-4" />}
      {children}
    </button>
  );
}
```

## 经验总结

**技术选型不是重点**，流程才是：

```
1. Token 层：颜色、间距、字体等原始值
2. 语义层：primary、error、surface 等有业务含义的别名
3. 组件层：封装设计决策的 React/Vue 组件
4. 文档层：Storybook + 使用示例

缺任何一层，设计系统都会不完整
```

**最大的挑战不是代码，是协作**：

- 设计师需要理解为什么要有 token
- 开发需要克制"自由发挥"的冲动
- 产品经理需要接受"这个颜色不在设计系统里，不能用"

## 小结

- 设计 Token 是设计系统的基础，不是组件库
- Style Dictionary 可以把 JSON token 生成 CSS 变量、JS 对象、TypeScript 类型
- Figma 变量 API 实现设计-代码双向同步
- 最难的部分是组织协作，不是技术
