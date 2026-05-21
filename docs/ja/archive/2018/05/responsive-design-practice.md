---
title: "レスポンシブデザインの実践：モバイルファーストから始める"
date: 2018-05-26 11:18:01
tags:
  - CSS
readingTime: 2
description: "いくつかのモバイルプロジェクトを経験して、レスポンシブデザインの実践経験をまとめます。"
wordCount: 286
---

いくつかのモバイルプロジェクトを経験して、レスポンシブデザインの実践経験をまとめます。

## モバイルファースト

まずモバイルのスタイルを書き、次に`min-width`メディアクエリで大画面向けに段階的に拡張します：

```css
/* ✅ モバイルファースト */
.container {
  padding: 16px; /* デフォルト：スマートフォン */
}

@media (min-width: 768px) {
  .container {
    padding: 24px; /* タブレット */
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px; /* デスクトップ */
  }
}

/* ❌ デスクトップファースト（非推奨 — モバイルで上書きが多すぎる）*/
.container {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 767px) {
  .container {
    max-width: 100%;
    padding: 16px;
  }
}
```

## ブレークポイントの設計

```css
/* 一般的なブレークポイント（主流デバイスに合わせて）*/
/* スマートフォン：< 576px（デフォルト、メディアクエリ不要）*/
/* 大型スマートフォン/小型タブレット：≥ 576px */
/* タブレット：≥ 768px */
/* 小型デスクトップ：≥ 992px */
/* 大型デスクトップ：≥ 1200px */

:root {
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 992px;
  --breakpoint-xl: 1200px;
}
```

## Flexboxによるレスポンシブ

```css
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card {
  /* スマートフォン：1行1枚 */
  flex: 1 1 100%;
}

@media (min-width: 576px) {
  .card {
    /* タブレット：1行2枚 */
    flex: 1 1 calc(50% - 8px);
  }
}

@media (min-width: 992px) {
  .card {
    /* デスクトップ：1行3枚 */
    flex: 1 1 calc(33.333% - 11px);
  }
}
```

## Gridによるレスポンシブ（推奨）

```css
.card-list {
  display: grid;
  /* 自動でレスポンシブ — メディアクエリ不要 */
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

## レスポンシブ画像

```html
<!-- srcset：DPRに基づいて画像を選択 -->
<img src="image.jpg" srcset="image.jpg 1x, image@2x.jpg 2x" alt="画像" />

<!-- sizes + srcset：ビューポート幅に基づいて画像を選択 -->
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, 33vw"
  alt="画像"
/>

<!-- picture：異なるデバイスに異なる画像 -->
<picture>
  <source media="(max-width: 576px)" srcset="mobile.jpg" />
  <source media="(max-width: 992px)" srcset="tablet.jpg" />
  <img src="desktop.jpg" alt="画像" />
</picture>
```

## レスポンシブタイポグラフィ

```css
/* 従来の方法：メディアクエリ */
h1 {
  font-size: 24px;
}
@media (min-width: 768px) {
  h1 {
    font-size: 32px;
  }
}
@media (min-width: 1200px) {
  h1 {
    font-size: 48px;
  }
}

/* モダンな方法：clamp() — レスポンシブかつ流動的 */
h1 {
  /* 最小24px、最大48px、中間は線形補間 */
  font-size: clamp(24px, 4vw, 48px);
}
```

## Vueのレスポンシブコンポーネント

```vue
<template>
  <div :class="containerClass">
    <component :is="currentLayout" />
  </div>
</template>

<script>
export default {
  data() {
    return { windowWidth: window.innerWidth };
  },
  computed: {
    isMobile() {
      return this.windowWidth < 768;
    },
    currentLayout() {
      return this.isMobile ? "MobileLayout" : "DesktopLayout";
    },
  },
  mounted() {
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    handleResize() {
      this.windowWidth = window.innerWidth;
    },
  },
};
</script>
```

## まとめ

- モバイルファースト：スマートフォン向けのデフォルトを書き、`min-width`で上方向に拡張
- CSSの`auto-fill + minmax`を使えば、メディアクエリなしでほとんどのレスポンシブレイアウトに対応
- `clamp()`でブレークポイントなしの流動的なタイポグラフィ
- レスポンシブ画像：`srcset` + `sizes`または`<picture>`で適切な解像度の画像を配信
