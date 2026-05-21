---
title: "CSS BEM Naming Convention in Practice"
date: 2019-05-01 10:39:56
tags:
  - CSS
readingTime: 1
description: "In the process of promoting CSS BEM naming conventions within the team, we ran into quite a few pitfalls. Here are some lessons learned that I hope will be usef"
wordCount: 105
---

In the process of promoting CSS BEM naming conventions within the team, we ran into quite a few pitfalls. Here are some lessons learned that I hope will be useful.

## Core Principles

BEM stands for **Block**, **Element**, **Modifier**. The naming format is:

```css
/* Block: a standalone, meaningful component */
.card {
}

/* Element: a part of a block (double underscore) */
.card__title {
}
.card__body {
}
.card__footer {
}

/* Modifier: a variant or state (double hyphen) */
.card--featured {
}
.card--disabled {
}
.card__title--large {
}
```

## Practical Example

```html
<div class="card card--featured">
  <div class="card__header">
    <h2 class="card__title card__title--large">Article Title</h2>
  </div>
  <div class="card__body">
    <p class="card__text">Content here...</p>
  </div>
  <div class="card__footer">
    <button class="card__btn card__btn--primary">Read More</button>
  </div>
</div>
```

```css
.card {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}
.card--featured {
  border-color: #409eff;
}
.card__title {
  font-size: 18px;
  margin: 0;
}
.card__title--large {
  font-size: 24px;
}
.card__btn {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.card__btn--primary {
  background: #409eff;
  color: #fff;
  border: none;
}
```

## Pitfalls to Avoid

1. **Don't nest BEM**: `.card__header__title` is wrong — use `.card__header-title` instead
2. **Modifiers don't stand alone**: always include the base class: `class="card__btn card__btn--primary"`
3. **Block boundaries**: child elements belong to the block, not nested elements' blocks

BEM significantly improves CSS maintainability in large projects by eliminating specificity conflicts and making the relationship between HTML and CSS immediately clear.
