---
title: "CSS Grid Layout in Practice"
date: 2018-04-19 10:12:47
tags:
  - CSS
readingTime: 1
description: "I covered CSS Grid basics back in January. This time, let's look at real project scenarios and see how Grid solves problems that Flexbox struggles with."
wordCount: 128
---

I covered CSS Grid basics back in January. This time, let's look at real project scenarios and see how Grid solves problems that Flexbox struggles with.

## Grid vs Flex: When to Use Each

```
Flex: one-dimensional layout (row OR column)
Grid: two-dimensional layout (row AND column)

Rule of thumb:
  - Navbar, toolbar, a single row of cards → Flex
  - Overall page structure, grid-style layouts → Grid
  - When unsure, try Flex first, switch to Grid if it's not enough
```

## Classic Admin Dashboard Layout

```css
.admin-layout {
  display: grid;
  grid-template-areas:
    "sidebar header"
    "sidebar content"
    "sidebar footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr auto;
  min-height: 100vh;
}

.sidebar {
  grid-area: sidebar;
}
.header {
  grid-area: header;
}
.content {
  grid-area: content;
}
.footer {
  grid-area: footer;
}
```

```html
<div class="admin-layout">
  <aside class="sidebar">Sidebar</aside>
  <header class="header">Top Navigation</header>
  <main class="content">Main Content</main>
  <footer class="footer">Footer</footer>
</div>
```

## Responsive Card Grid

```css
.card-grid {
  display: grid;
  /* auto-fill: as many columns as possible; minmax: each column min 280px, max stretch */
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

No media queries needed at all — the number of columns adjusts automatically based on container width:

- Wide screen: 4–5 columns
- Medium screen: 3 columns
- Narrow screen: 2 columns
- Mobile: 1 column

## Magazine-Style Mixed Layout

```css
.magazine {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 200px;
  gap: 8px;
}

/* Large image spanning multiple columns and rows */
.featured {
  grid-column: span 2;
  grid-row: span 2;
}
```

```html
<div class="magazine">
  <article class="featured">Featured Article</article>
  <article>Short Article</article>
  <article>Short Article</article>
  <article>Short Article</article>
  <article>Short Article</article>
</div>
```

## Centering a Child Element (Grid's Secret Weapon)

```css
/* Perfect center alignment with Grid */
.center-container {
  display: grid;
  place-items: center; /* shorthand for align-items: center + justify-items: center */
  min-height: 100vh;
}
```

One fewer line than Flexbox's `align-items + justify-content`.

## Alignment Control

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);

  /* Alignment of the entire grid within its container */
  justify-content: center; /* horizontal: start | center | end | space-between */
  align-content: start; /* vertical: same options */

  /* Alignment of each item within its grid cell */
  justify-items: stretch; /* horizontal: start | center | end | stretch */
  align-items: center; /* vertical: same options */
}

/* Override for a single item */
.special-item {
  justify-self: end;
  align-self: start;
}
```

## Summary

- `grid-template-areas`: visually define your layout — ideal for admin dashboards
- `repeat(auto-fill, minmax(280px, 1fr))`: responsive cards without media queries
- `span N`: span elements across multiple columns/rows for magazine layouts
- `place-items: center`: quick centering in one line
