---
title: "CSS BEM 命名規範"
date: 2018-09-14 14:48:41
tags:
  - CSS
readingTime: 1
description: "項目做大了，CSS 命名開始混亂：`.title`、`.list-item`、`.active`……全局樣式衝突越來越多。用 BEM 規範統一命名之後，問題少了很多。"
wordCount: 122
---

項目做大了，CSS 命名開始混亂：`.title`、`.list-item`、`.active`……全局樣式衝突越來越多。用 BEM 規範統一命名之後，問題少了很多。

## BEM 是什麼

BEM = Block（塊）、Element（元素）、Modifier（修飾符）

```
Block（塊）：獨立的組件，如 header、menu、card
Element（元素）：塊的組成部分，用 __ 連接，如 card__title、menu__item
Modifier（修飾符）：塊或元素的狀態/變體，用 -- 連接，如 card--dark、menu__item--active
```

## 命名格式

```css
/* Block */
.card {
}

/* Element（屬於 card 的子元素）*/
.card__title {
}
.card__content {
}
.card__footer {
}

/* Modifier（card 的變體）*/
.card--dark {
}
.card--horizontal {
}

/* Element + Modifier */
.card__title--large {
}
```

## 實際例子

```html
<!-- 商品卡片 -->
<div class="product-card product-card--featured">
  <img class="product-card__image" src="..." />
  <div class="product-card__body">
    <h3 class="product-card__title">商品名稱</h3>
    <p class="product-card__price">¥99</p>
    <p class="product-card__price product-card__price--original">¥199</p>
  </div>
  <div class="product-card__footer">
    <button class="product-card__btn product-card__btn--primary">
      加入購物車
    </button>
    <button class="product-card__btn product-card__btn--secondary">收藏</button>
  </div>
</div>
```

```css
.product-card {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

/* Modifier：特色商品 */
.product-card--featured {
  border-color: #f90;
  box-shadow: 0 2px 8px rgba(255, 153, 0, 0.3);
}

.product-card__image {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.product-card__price {
  color: #f40;
  font-size: 18px;
  font-weight: bold;
}

/* 原價（劃線）*/
.product-card__price--original {
  color: #999;
  font-size: 14px;
  text-decoration: line-through;
}
```

## 用 SCSS 寫 BEM

```scss
.product-card {
  border: 1px solid #eee;

  // &-- 生成 Modifier
  &--featured {
    border-color: #f90;
  }

  // &__ 生成 Element
  &__image {
    width: 100%;
  }

  &__price {
    color: #f40;

    // Element 的 Modifier
    &--original {
      color: #999;
      text-decoration: line-through;
    }
  }
}
```

## BEM 的好處

```
1. 命名自解釋：看類名就知道這個元素是什麼、屬於哪裏
2. 低優先級：只用類選擇器，不用嵌套，樣式權重一致
3. 可複用：Block 是獨立的，可以放到任何地方
4. 低耦合：不依賴 HTML 結構，重構不怕
```

## 不適合用 BEM 的地方

```
- 工具類（如 .text-center、.mt-16）不用 BEM
- 狀態類（如 .is-active、.has-error）習慣用 is-/has- 前綴
- 全局重置樣式
```

## 和 Vue scoped 配合

```vue
<style scoped>
/* scoped 已經有了隔離，可以適當簡化 BEM */
/* 不需要寫完整的 block 名，因為 scoped 已經加了哈希 */
.card {
}
.card__title {
}
.card--dark {
}
</style>
```

## 小結

- `block__element--modifier` 三層命名
- 只用類選擇器，不嵌套，保持低優先級
- SCSS `&__` 和 `&--` 讓 BEM 更方便寫
- 狀態類用 `.is-active`、`.has-error` 前綴