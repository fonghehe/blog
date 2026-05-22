---
title: "Tailwind CSS 4：全新アーキテクチャ解説"
date: 2025-02-08 13:42:19
tags:
  - CSS
  - エンジニアリング
readingTime: 2
description: "Tailwind CSS 4.0 が正式リリースされました。これはゼロから書き直された大型アップグレードです。新アーキテクチャの変更点と移行時の注意事項について解説します。"
wordCount: 346
---

Tailwind CSS 4.0 が正式リリースされました。これはゼロから書き直された大型アップグレードです。新アーキテクチャの変更点と移行時の注意事項について解説します。

## 主な変更点

```
v3 → v4 の主な変更点：
  1. 新しいエンジン（Oxide）、ビルド速度 10 倍向上
  2. CSS ファースト設定、tailwind.config.js が不要に
  3. ネイティブ cascade layers のサポート
  4. 自動 content 検出、content 設定が不要に
  5. 新しいバリアント構文（@variant）
  6. CSS 変数の全面採用
```

## CSS ファースト設定

```css
/* v4: app.css — CSS 内で直接設定 */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --font-sans: "Inter", system-ui, sans-serif;
  --breakpoint-3xl: 1920px;

  /* カスタム spacing */
  --spacing-128: 32rem;
  --spacing-144: 36rem;

  /* カスタムアニメーション */
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

```js
// v3: tailwind.config.js — もう不要
module.exports = {
  theme: {
    extend: {
      colors: { primary: "#3b82f6" },
    },
  },
  content: ["./src/**/*.{tsx,ts}"],
};
```

## Vite との統合

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(), // PostCSS の代替
  ],
});
```

PostCSS パイプラインを経由しなくなったため、ビルド速度が大幅に向上しました。

## Cascade Layers

```css
/* v4 は CSS cascade layers を自動使用 */
/* 優先度順：
   1. base（リセットスタイル）
   2. components（コンポーネントスタイル）
   3. utilities（ユーティリティクラス）
*/

/* カスタム layer */
@layer components {
  .btn-primary {
    @apply bg-primary text-white px-4 py-2 rounded-lg;
    @apply hover:bg-primary/90 transition-colors;
  }
}
```

これにより `!important` の乱用問題が解決され、ユーティリティクラスは自然にコンポーネントスタイルより優先されます。

## 新しいバリアント構文

```html
<!-- ダークモード -->
<div class="bg-white dark:bg-gray-900">
  <!-- レスポンシブ -->
  <p class="text-sm md:text-base lg:text-lg">レスポンシブテキスト</p>
  <!-- コンテナクエリ -->
  <div class="@container">
    <div class="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3">
      <!-- コンテナ幅に応じてレスポンシブ -->
    </div>
  </div>
</div>
```

## 移行ガイド

```bash
# 1. v4 のインストール
npm install tailwindcss@latest @tailwindcss/vite@latest

# 2. PostCSS 設定の削除
rm postcss.config.js

# 3. CSS エントリの更新
# tailwind.config.js の内容を CSS の @theme ブロックに移行

# 4. 公式移行ツールの実行
npx @tailwindcss/upgrade
```

## shadcn/ui との連携

```css
/* shadcn/ui 対応の CSS 変数 */
@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  /* ... その他の変数 */
}
```

shadcn/ui は v4 でも正常に動作します。CSS 変数の宣言方法を調整するだけです。

## まとめ

- Tailwind CSS 4 のコアはパフォーマンスと開発体験の向上
- CSS ファースト設定でテーマ管理がより直感的に
- Oxide エンジンでビルドが 10 倍高速化
- Cascade Layers で優先度問題が解決
- Vite との統合がよりスムーズに
- 移行ツールが成熟しており、ほとんどのプロジェクトはワンコマンドで移行可能
