---
title: "CSS View Transitions API：無縫頁面過渡"
date: 2024-07-20 10:00:00
tags:
  - CSS
  - JavaScript
readingTime: 2
description: "View Transitions API 是 Chrome 111 開始支援的新特性，不需要任何 JS 框架就能實現流暢的頁面過渡動畫。"
---

View Transitions API 是 Chrome 111 開始支援的新特性，不需要任何 JS 框架就能實現流暢的頁面過渡動畫。

## 最簡單的例子

```javascript
// 沒有 View Transitions：立即切換，無動畫
document.querySelector(".content").textContent = "新內容";

// 有 View Transitions：自動生成淡入淡出
document.startViewTransition(() => {
  document.querySelector(".content").textContent = "新內容";
});
```

就這麼簡單。瀏覽器會自動：

1. 截圖當前狀態
2. 執行你的 DOM 更新
3. 截圖新狀態
4. 播放從舊 → 新的動畫（預設淡入淡出）

## 自定義過渡動畫

```css
/* 預設動畫（改變持續時間） */
::view-transition-old(root) {
  animation-duration: 0.3s;
}

::view-transition-new(root) {
  animation-duration: 0.3s;
}

/* 自定義：從左滑入 */
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

## 元素級別的過渡（Shared Element Transitions）

```css
/* 給特定元素命名，實現"英雄動畫"（hero animation）*/
.product-card {
  view-transition-name: product-card;
}

/* 或者動態設定 */
```

```javascript
document.startViewTransition(() => {
  // 在列表頁：小圖片
  // 在詳情頁：大圖片
  // 瀏覽器自動插值動畫！
  router.push(`/product/${id}`);
});
```

```css
/* 詳情頁的圖片 */
.product-detail-image {
  view-transition-name: product-card; /* 和列表頁同名 */
}
```

## 在 React 中使用

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

## 在 Vue 中使用

```javascript
// vue-router 4.4+ 內建了 View Transitions 支援
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

## Astro 的內建支援

```astro
---
import { ViewTransitions } from 'astro:transitions'
---

<head>
  <ViewTransitions />
</head>

<!-- 元素級別過渡 -->
<img
  src={post.cover}
  transition:name={`post-cover-${post.slug}`}
  transition:animate="morph"
/>
```

Astro 封裝得最好用，MPA 也能有流暢的頁面過渡。

## 瀏覽器支援

```
Chrome 111+：✅ 完整支援
Edge 111+：✅ 完整支援
Safari 18+（2024年9月）：✅ 基礎支援
Firefox：⏳ 開發中

目前需要 feature detection：
if (document.startViewTransition) {
  // 用動畫
} else {
  // 直接切換
}
```

## 小結

- View Transitions API 不需要任何框架，幾行 CSS/JS 就能實現專業動畫
- Shared Element Transitions 讓頁面間的元素"飛"過去
- React/Vue/Astro 都有封裝，實際專案容易接入
- 當前 Firefox 還不支援，需要降級處理
- 2024 年值得加入生產專案，漸進增強
