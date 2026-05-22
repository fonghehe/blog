---
title: "Tailwind CSS 4.0：Oxide エンジンと CSS-first 設定"
date: 2024-09-05 19:39:16
tags:
  - CSS
  - エンジニアリング
readingTime: 2
description: "Tailwind CSS 4.0 Beta のテストが開始されました。最大の変更点は、基盤エンジンを Rust で書き直したこと（Oxide）と、設定を JS ファイルから CSS ファイルに移行したことです。"
wordCount: 493
---

Tailwind CSS 4.0 Beta のテストが開始されました。最大の変更点は、基盤エンジンを Rust で書き直したこと（Oxide）と、設定を JS ファイルから CSS ファイルに移行したことです。

## スピード向上

```
Tailwind 3（Node.js）：完整构建 ~3.5s，增量 ~950ms
Tailwind 4（Oxide/Rust）：完整构建 ~0.1s，增量 ~15ms

增量构建快了 60 倍
```

この速度向上は大規模プロジェクトにとって非常に重要です。

## インストール

```bash
npm install tailwindcss@next @tailwindcss/vite@next
```

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default {
  plugins: [tailwindcss()],
};
```

注意：`postcss.config.js` は不要になりました！

## CSS-ファースト設定

Tailwind 4 の設定は CSS に直接記述します：

```css
/* 旧版（tailwind.config.js）*/
/*
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
      }
    }
  }
}
*/

/* 新版（直接在 CSS 文件里）*/
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-primary-dark: #1d4ed8;

  --font-display: "Inter", sans-serif;

  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;

  --breakpoint-xs: 475px;
}
```

然后就可以用这些自定义变量：

```html
<button class="bg-primary hover:bg-primary-dark text-white px-6 py-spacing-18">
  ボタン
</button>
```

## 自動コンテンツ検出

```css
/* Tailwind 3：config で content パスを宣言する必要あり */
/* content: ['./src/**/*.{html,js,tsx,vue}'] */

/* Tailwind 4：自動検出！設定不要 */
@import "tailwindcss";
```

## 新しいCSS変数API

```css
/* Tailwind 4 の CSS 変数が直接使用可能 */
.my-component {
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: var(--spacing-18);
}
```

## ネイティブCSSネストサポート

```css
/* 現在 @layer 内でネイティブ CSS ネストを使用可能 */
@layer components {
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;

    &:hover {
      opacity: 0.9;
    }

    &.btn-primary {
      background-color: var(--color-primary);
      color: white;
    }
  }
}
```

## 移行：v3からv4へ

ほとんどのクラス名は変わりませんが、主な変更点：

```html
<!-- 旧バージョン -->
<div class="bg-opacity-50 text-opacity-75">
  <!-- 新バージョン（スラッシュ構文を使用）-->
  <div class="bg-black/50 text-white/75"></div>
</div>
```

```html
<!-- 旧バージョン：shadow 色 -->
<div class="shadow-lg shadow-blue-500/50">
  <!-- 新バージョン：同じ（v3 で既にサポート済み）-->
  <div class="shadow-lg shadow-blue-500/50"></div>
</div>
```

官方提供了升级工具：

```bash
npx @tailwindcss/upgrade@next
```

## 所感

設定が JS から CSS に移行するこの変更は最初は少し戸惑いますが、考えてみると実際にはより合理的です：

- CSS 変数は本来スタイルシステムの設定項目として適している
- JS を実行しなくても設定を取得できる
- IDE で直接カラープレビューを確認できる

速度向上は確実であり、特に大規模プロジェクトでのインクリメンタルビルド 15ms は非常に体感が良いです。

## まとめ

- Oxide エンジン（Rust）：インクリメンタルビルドが60倍高速
- CSS-first 設定：`@theme` ブロック内で CSS 変数を使ってテーマを定義
- 自動コンテンツ検出：`content` パスの手動設定が不要
- 公式アップグレードツールにより、移行は比較的スムーズ
- 現在はまだ Beta、本番環境は正式版を待つ
