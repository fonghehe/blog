---
title: "CSS BEM Naming Convention"
date: 2018-09-14 14:48:41
tags:
  - CSS
readingTime: 1
description: "As projects grow, CSS naming gets chaotic: `.title`, `.list-item`, `.active`... global style conflicts pile up. Adopting the BEM convention solved many of these"
---

As projects grow, CSS naming gets chaotic: `.title`, `.list-item`, `.active`... global style conflicts pile up. Adopting the BEM convention solved many of these issues.

## What is BEM

BEM = Block, Element, Modifier

```
Block: Independent component, e.g. header, menu, card
Element: Part of a block, connected with __, e.g. card__title, menu__item
Modifier: State/variant of a block or element, connected with --, e.g. card--dark, menu__item--active
```

## Naming Format

```css
/* Block */
.card {
}

/* Element (child of card) */
.card__title {
}
.card__content {
}
.card__footer {
}

/* Modifier (variant of card) */
.card--dark {
}
.card--horizontal {
}

/* Element + Modifier */
.card__title--large {
}
```

## Real-World Example

```html
<!-- Product card -->
<div class="product-card product-card--featured">
  <img class="product-card__image" src="..." />
  <div class="product-card__body">
    <h3 class="product-card__title">Product Name</h3>
    <p class="product-card__price">$9.99</p>
    <p class="product-card__price product-card__price--original">$19.99</p>
  </div>
  <div class="product-card__footer">
    <button class="product-card__btn product-card__btn--primary">
      Add to Cart
    </button>
    <button class="product-card__btn product-card__btn--secondary">
      Wishlist
    </button>
  </div>
</div>
```

```css
.product-card {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

/* Modifier: featured product */
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

/* Original price (strikethrough) */
.product-card__price--original {
  color: #999;
  font-size: 14px;
  text-decoration: line-through;
}
```

## Writing BEM with SCSS

```scss
.product-card {
  border: 1px solid #eee;

  // &-- generates Modifier
  &--featured {
    border-color: #f90;
  }

  // &__ generates Element
  &__image {
    width: 100%;
  }

  &__price {
    color: #f40;

    // Element's Modifier
    &--original {
      color: #999;
      text-decoration: line-through;
    }
  }
}
```

## Benefits of BEM

```
1. Self-documenting names: you know what an element is and where it belongs just from the class name
2. Low specificity: only class selectors, no nesting, consistent weight
3. Reusable: Blocks are independent and can be placed anywhere
4. Loosely coupled: not dependent on HTML structure, safe to refactor
```

## When Not to Use BEM

```
- Utility classes (e.g. .text-center, .mt-16) don't need BEM
- State classes (e.g. .is-active, .has-error) conventionally use is-/has- prefixes
- Global reset styles
```

## With Vue Scoped Styles

```vue
<style scoped>
/* scoped already provides isolation, BEM can be simplified */
/* No need for the full block name since scoped adds a hash */
.card {
}
.card__title {
}
.card--dark {
}
</style>
```
