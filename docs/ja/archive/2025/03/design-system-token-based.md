---
title: "デザインシステム構築：コンポーネントライブラリからデザイントークンへ"
date: 2025-03-15 10:00:00
tags:
  - フロントエンド
readingTime: 3
description: "過去 1 年間、チームでゼロからデザインシステムを構築しました。UI コンポーネントライブラリを購入してデザインシステムと呼ぶのではなく、ゼロから構築したものです。そのプロセスをまとめます。"
wordCount: 395
---

過去 1 年間、チームでゼロからデザインシステムを構築しました。UI コンポーネントライブラリを購入してデザインシステムと呼ぶのではなく、ゼロから構築したものです。そのプロセスをまとめます。

## なぜデザインシステムが必要か

症状：

- ページによってボタンのスタイルが一致しない（border-radius: 4px、6px、8px が混在）
- 同じ色がコード内で 5 種類の異なる書き方で記述されている（`#3B82F6`、`blue-500`、`primary`、`brand`…）
- デザインで色を変更すると、コード内でグローバル検索・置換が必要
- 新しいメンバーがどのコンポーネントを使えばよいかわからない

デザインシステムが解決するコア問題：**Single Source of Truth（唯一の信頼できる情報源）**。

## ステップ 1：デザイントークンの確立

```
デザイントークン = デザインの決定事項に名前を付けること

NG：#3B82F6（セマンティクスなし）
OK：color.brand.primary = #3B82F6（セマンティクスあり）
```

```json
// tokens/colors.json（Style Dictionary 形式）
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

## Style Dictionary でコードを生成

```javascript
// style-dictionary.config.js
const StyleDictionary = require("style-dictionary");

module.exports = {
  source: ["tokens/**/*.json"],
  platforms: {
    // CSS 変数を生成
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
    // JS オブジェクトを生成（Tailwind 用）
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
    // TypeScript 型を生成
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

生成された CSS：

```css
:root {
  --ds-color-brand-primary: #3b82f6;
  --ds-color-brand-primary-dark: #1d4ed8;
  --ds-color-neutral-900: #111827;
  --ds-spacing-4: 16px;
}
```

## Figma 変数の同期

2024 年に Figma が変数 API を導入し、コードのトークンと双方向同期が可能になりました：

```javascript
// scripts/sync-figma-tokens.js
const { FigmaAPI } = require("@figma/rest-api-spec");

async function syncToFigma(tokens) {
  const api = new FigmaAPI({ personalAccessToken: process.env.FIGMA_TOKEN });

  // 現在の Figma 変数を取得
  const { variables } = await api.getLocalVariables(FILE_KEY);

  // 差分を比較して更新
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

実際の効果：デザイナーが色を変更 → 同期スクリプトを実行 → コードが自動更新。

## コンポーネントレイヤー：サードパーティライブラリとは異なるアプローチ

```tsx
// 私たちの Button は機能が充実した汎用コンポーネントではなく
// 私たちのデザイン決定をカプセル化したものです

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
        // ベーススタイル
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
```
