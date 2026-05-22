---
title: "CSS View Transitions API：シームレスなページトランジション"
date: 2024-07-20 11:34:11
tags:
  - CSS
  - JavaScript
readingTime: 2
description: "View Transitions API 是 Chrome 111 开始支持的新特性，不需要任何 JS 框架就能实现流畅的页面过渡动画。"
wordCount: 250
---

View Transitions API 是 Chrome 111 开始支持的新特性，不需要任何 JS 框架就能实现流畅的页面过渡动画。

## 最もシンプルな例

```javascript
// 没有 View Transitions：立即切换，无动画
document.querySelector(".content").textContent = "新内容";

// 有 View Transitions：自动生成淡入淡出
document.startViewTransition(() => {
  document.querySelector(".content").textContent = "新内容";
});
```

就这么简单。浏览器会自动：

1. 截图当前状态
2. 执行你的 DOM 更新
3. 截图新状态
4. 播放从旧 → 新的动画（默认淡入淡出）

## 自定义过渡动画

```css
/* 默认动画（改变持续时间） */
::view-transition-old(root) {
  animation-duration: 0.3s;
}

::view-transition-new(root) {
  animation-duration: 0.3s;
}

/* 自定义：从左滑入 */
@keyframes slide-in-from-right {
  from {
    transform: translateX(100%);
  }
}

@keyframes slide-out-to-left {
  to {
    transform: translateX(-100%);
  }
}

::view-transition-old(root) {
  animation: 0.3s ease-in slide-out-to-left;
}

::view-transition-new(root) {
  animation: 0.3s ease-out slide-in-from-right;
}
```

## 要素レベルのトランジション（Shared Element Transitions）

```css
/* 给特定元素命名，实现"英雄动画"（hero animation）*/
.product-card {
  view-transition-name: product-card;
}

/* 或者动态设置 */
```

```javascript
document.startViewTransition(() => {
  // 在列表页：小图片
  // 在详情页：大图片
  // 浏览器自动插值动画！
  router.push(`/product/${id}`);
});
```

```css
/* 详情页的图片 */
.product-detail-image {
  view-transition-name: product-card; /* 和列表页同名 */
}
```

## Reactでの使い方

```tsx
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

function useNavigateWithTransition() {
  const navigate = useNavigate();

  return useCallback(
    (to: string) => {
      if (!document.startViewTransition) {
        navigate(to);
        return;
      }

      document.startViewTransition(() => {
        navigate(to);
      });
    },
    [navigate],
  );
}

// 使用
function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigateWithTransition();

  return (
    <div
      style={{ viewTransitionName: `product-${product.id}` }}
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <img src={product.image} />
      <h2>{product.name}</h2>
    </div>
  );
}
```

## Vueでの使い方

```javascript
// vue-router 4.4+ 内置了 View Transitions 支持
const router = createRouter({
  // ...
});

router.beforeEach(() => {
  if (!document.startViewTransition) return;

  return new Promise((resolve) => {
    document.startViewTransition(resolve);
  });
});
```

## Astroのビルトインサポート

```astro
---
import { ViewTransitions } from 'astro:transitions'
---

<head>
  <ViewTransitions />
</head>

<!-- 元素级别过渡 -->
<img
  src={post.cover}
  transition:name={`post-cover-${post.slug}`}
  transition:animate="morph"
/>
```

Astro 封装得最好用，MPA 也能有流畅的页面过渡。

## ブラウザサポート

```
Chrome 111+：✅ 完整支持
Edge 111+：✅ 完整支持
Safari 18+（2024年9月）：✅ 基础支持
Firefox：⏳ 开发中

目前需要 feature detection：
if (document.startViewTransition) {
  // 用动画
} else {
  // 直接切换
}
```

## まとめ

- View Transitions API 不需要任何框架，几行 CSS/JS 就能实现专业动画
- Shared Element Transitions 让页面间的元素"飞"过去
- React/Vue/Astro 都有封装，实际项目容易接入
- 当前 Firefox 还不支持，需要降级处理
- 2024 年值得加入生产项目，渐进增强
