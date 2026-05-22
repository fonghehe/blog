---
title: "CSS アーキテクチャの進化：BEM から Utility-First へ"
date: 2021-09-27 14:31:11
tags:
  - CSS

readingTime: 3
description: "今年、チーム内で CSS アーキテクチャのアップグレードを推進しました——BEM 命名規則から Utility-First 方式への段階的な移行です。このプロセスでは議論や妥協もありましたが、最終的にバランスの取れた解を見つけることができました。"
wordCount: 719
---

今年、チーム内で CSS アーキテクチャのアップグレードを推進しました——BEM 命名規則から Utility-First 方式への段階的な移行です。このプロセスでは議論や妥協もありましたが、最終的にバランスの取れた解を見つけることができました。

## BEM の課題

BEM（Block-Element-Modifier）を 4 年間使ってきました。命名の衝突問題は解決できましたが、プロジェクトが大きくなるにつれて、新たな問題が浮き彫りになってきました：

```css
/* BEM 的典型代码 */
.card { }
.card__header { }
.card__header__title { }
.card__header__title--highlighted { }
.card__body { }
.card__body__content { }
.card__body__content--loading { }

/* 問題1：ネストが深いと命名が爆発的に増える */
.data-table__row__cell__link__icon--active { }

/* 問題2：各コンポーネントに大量の CSS を書く必要がある */
/* card.css - 200+ 行あり、その 60% がレイアウトと余白 */
.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
}
/* これらの flex、padding、margin が多数のコンポーネントで重複している */
```

核心的な問題は、CSS ファイルの肥大化、レイアウトスタイルの重複、命名による認知的負荷の高さです。

## Utility-First の利点

```html
<!-- 以前：HTML + 对应的 BEM CSS -->
<div class="card">
  <div class="card__header">
    <h3 class="card__header__title">标题</h3>
  </div>
</div>

<!-- Utility-First：样式直接在 HTML 中 -->
<div class="rounded-lg bg-white shadow-md">
  <div class="flex items-center justify-between p-4 mb-3">
    <h3 class="text-lg font-semibold text-gray-900">标题</h3>
  </div>
</div>
```

利点は明らかです：HTML と CSS を行き来する必要がなく、命名を考える必要もなく、スタイルが一目で分かります。しかし、初期のチームの抵抗も大きかったです——「HTML が醜すぎる」「インラインスタイルと何が違うのか」と。

## 私たちの妥協案

Utility-First を全面的に採用するのではなく、階層的に処理することにしました：

```html
<!-- 1. 布局用 utility classes -->
<div class="grid grid-cols-3 gap-4 p-6">
  <!-- 2. 组件语义部分用 BEM -->
  <article class="card">
    <div class="card__header">
      <!-- 3. 细节调整用 utility classes -->
      <h3 class="card__title text-lg mb-1">标题</h3>
      <span class="card__badge bg-red-500 text-white px-2 py-0.5 rounded">
        NEW
      </span>
    </div>
    <div class="card__body text-gray-600">
      内容
    </div>
  </article>
</div>
```

原則は次の通りです：
- **レイアウトと余白**：utility classes を使用し、CSS を書かない
- **コンポーネントの構造スタイル**：BEM を使用し、セマンティクスを維持
- **色とフォントの微調整**：utility classes を使用

## CSS変数でDesign Tokenを統一する

どんな CSS 方法論を使うにせよ、Design Token は統一管理すべきです：

```css
:root {
  /* 余白システム */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  /* カラーシステム */
  --color-primary: #1890ff;
  --color-text: #333;
  --color-text-secondary: #666;

  /* フォント */
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;

  /* 角丸 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* コンポーネントでの使用 */
.card {
  border-radius: var(--radius-md);
  padding: var(--space-4);
  color: var(--color-text);
}
```

## ツールチェーン設定

Windi CSS（Tailwind 互換の API）を utility ツールとして使用し、Vite と組み合わせています：

```javascript
// vite.config.ts
import WindiCSS from 'vite-plugin-windicss'

export default {
  plugins: [
    WindiCSS({
      scan: {
        dirs: ['src'],
        fileExtensions: ['vue', 'ts', 'jsx']
      }
    })
  ]
}
```

Windi CSS のオンデマンド生成機能により、最終的な CSS のサイズは非常に小さく、JIT モードではすべての utility が必要に応じてコンパイルされます。

## まとめ

- BEM は時代遅れというわけではなく、レイアウトや余白のレベルで過剰に冗長になっている
- Utility-First は全面的に採用するのではなく、BEM と組み合わせて使う方が良い
- Design Token は CSS 変数で管理すべきであり、どんな方法論を使うにせよ必要
- Windi CSS / Tailwind JIT により、Utility-First 方式の実行時オーバーヘッドはほぼゼロ
- チームの受け入れは段階的に進める必要があり、まずはレイアウトスタイルから始める