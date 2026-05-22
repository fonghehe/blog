---
title: "設計系統建設：從元件庫到設計 Token"
date: 2025-03-15 13:29:06
tags:
  - 前端
readingTime: 3
description: "過去一年，我們團隊建了一套設計系統。不是買了個 UI 元件庫就叫設計系統，而是從零建設的。整理一下這個過程。"
wordCount: 391
---

過去一年，我們團隊建了一套設計系統。不是買了個 UI 元件庫就叫設計系統，而是從零建設的。整理一下這個過程。

## 為什麼需要設計系統

症狀：

- 不同頁面的按鈕樣式不一致（圓角 4px、6px、8px 都有）
- 相同的顏色在程式碼裡用了五種不同寫法（`#3B82F6`、`blue-500`、`primary`、`brand`...）
- 設計稿改了顏色，需要在程式碼裡全域性搜尋
- 新人入職不知道該用哪個元件

設計系統解決的核心問題：**單一事實來源（Single Source of Truth）**。

## 第一步：建立設計 Token

```
設計 Token = 將設計決策命名化

不是：#3B82F6（沒有語義）
而是：color.brand.primary = #3B82F6（有語義）
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

## 用 Style Dictionary 生成程式碼

```javascript
// style-dictionary.config.js
const StyleDictionary = require("style-dictionary");

module.exports = {
  source: ["tokens/**/*.json"],
  platforms: {
    // 生成 CSS 變數
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
    // 生成 JS 物件（給 Tailwind 用）
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
    // 生成 TypeScript 型別
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

## Figma 變數同步

2024 年 Figma 推出了變數 API，可以和程式碼 token 雙向同步：

```javascript
// scripts/sync-figma-tokens.js
const { FigmaAPI } = require("@figma/rest-api-spec");

async function syncToFigma(tokens) {
  const api = new FigmaAPI({ personalAccessToken: process.env.FIGMA_TOKEN });

  // 讀取當前 Figma 變數
  const { variables } = await api.getLocalVariables(FILE_KEY);

  // 對比差異，更新
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

實際效果：設計師改了顏色 → 跑同步指令碼 → 程式碼自動更新。

## 元件層：不同於第三方元件庫的思路

```tsx
// 我們的 Button 不是功能全面的通用元件
// 而是封裝了我們的設計決策

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
        // 基礎樣式
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

## 經驗總結

**技術選型不是重點**，流程才是：

```
1. Token 層：顏色、間距、字型等原始值
2. 語義層：primary、error、surface 等有業務含義的別名
3. 元件層：封裝設計決策的 React/Vue 元件
4. 文件層：Storybook + 使用示例

缺任何一層，設計系統都會不完整
```

**最大的挑戰不是程式碼，是協作**：

- 設計師需要理解為什麼要有 token
- 開發需要剋製"自由發揮"的衝動
- 產品經理需要接受"這個顏色不在設計系統裡，不能用"

## 小結

- 設計 Token 是設計系統的基礎，不是元件庫
- Style Dictionary 可以把 JSON token 生成 CSS 變數、JS 物件、TypeScript 型別
- Figma 變數 API 實現設計-程式碼雙向同步
- 最難的部分是組織協作，不是技術
