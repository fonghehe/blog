---
title: "CSS BEM 命名规范"
date: 2018-09-14 14:48:41
tags:
  - CSS
readingTime: 1
description: "项目做大了，CSS 命名开始混乱：`.title`、`.list-item`、`.active`……全局样式冲突越来越多。用 BEM 规范统一命名之后，问题少了很多。"
wordCount: 122
---

项目做大了，CSS 命名开始混乱：`.title`、`.list-item`、`.active`……全局样式冲突越来越多。用 BEM 规范统一命名之后，问题少了很多。

## BEM 是什么

BEM = Block（块）、Element（元素）、Modifier（修饰符）

```
Block（块）：独立的组件，如 header、menu、card
Element（元素）：块的组成部分，用 __ 连接，如 card__title、menu__item
Modifier（修饰符）：块或元素的状态/变体，用 -- 连接，如 card--dark、menu__item--active
```

## 命名格式

```css
/* Block */
.card {
}

/* Element（属于 card 的子元素）*/
.card__title {
}
.card__content {
}
.card__footer {
}

/* Modifier（card 的变体）*/
.card--dark {
}
.card--horizontal {
}

/* Element + Modifier */
.card__title--large {
}
```

## 实际例子

```html
<!-- 商品卡片 -->
<div class="product-card product-card--featured">
  <img class="product-card__image" src="..." />
  <div class="product-card__body">
    <h3 class="product-card__title">商品名称</h3>
    <p class="product-card__price">¥99</p>
    <p class="product-card__price product-card__price--original">¥199</p>
  </div>
  <div class="product-card__footer">
    <button class="product-card__btn product-card__btn--primary">
      加入购物车
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

/* 原价（划线）*/
.product-card__price--original {
  color: #999;
  font-size: 14px;
  text-decoration: line-through;
}
```

## 用 SCSS 写 BEM

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

## BEM 的好处

```
1. 命名自解释：看类名就知道这个元素是什么、属于哪里
2. 低优先级：只用类选择器，不用嵌套，样式权重一致
3. 可复用：Block 是独立的，可以放到任何地方
4. 低耦合：不依赖 HTML 结构，重构不怕
```

## 不适合用 BEM 的地方

```
- 工具类（如 .text-center、.mt-16）不用 BEM
- 状态类（如 .is-active、.has-error）习惯用 is-/has- 前缀
- 全局重置样式
```

## 和 Vue scoped 配合

```vue
<style scoped>
/* scoped 已经有了隔离，可以适当简化 BEM */
/* 不需要写完整的 block 名，因为 scoped 已经加了哈希 */
.card {
}
.card__title {
}
.card--dark {
}
</style>
```

## 小结

- `block__element--modifier` 三层命名
- 只用类选择器，不嵌套，保持低优先级
- SCSS `&__` 和 `&--` 让 BEM 更方便写
- 状态类用 `.is-active`、`.has-error` 前缀