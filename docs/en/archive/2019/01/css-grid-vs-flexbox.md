---
title: "CSS Grid Layout in Practice: Scenarios Where It Truly Replaces Flexbox"
date: 2019-01-24 17:49:08
tags:
  - CSS
readingTime: 1
description: "Flexbox is one-dimensional; Grid is two-dimensional. After learning Grid, many layouts that were awkward to achieve with Flexbox become straightforward."
---

Flexbox is one-dimensional; Grid is two-dimensional. After learning Grid, many layouts that were awkward to achieve with Flexbox become straightforward.

## Grid Core Concepts

```css
.container {
  display: grid;

  /* Define columns: 3 columns, each 1fr */
  grid-template-columns: 1fr 1fr 1fr;
  /* shorthand */
  grid-template-columns: repeat(3, 1fr);

  /* Define rows */
  grid-template-rows: 100px auto;

  /* Gap */
  gap: 16px; /* same gap for rows and columns */
  gap: 20px 16px; /* row-gap column-gap */
}
```

## Classic Page Layout

```css
/* Holy Grail layout (header + 3 columns + footer) */
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "footer footer footer";
  grid-template-columns: 200px 1fr 160px;
  grid-template-rows: 60px 1fr 50px;
  min-height: 100vh;
  gap: 0;
}

.header {
  grid-area: header;
}
.nav {
  grid-area: nav;
}
.main {
  grid-area: main;
}
.aside {
  grid-area: aside;
}
.footer {
  grid-area: footer;
}
```

## Auto-Responsive Column Count (Most Common)

```css
/* Each column at minimum 250px, auto-fill columns */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

/* auto-fill vs auto-fit */
/* auto-fill: preserves empty column placeholders */
/* auto-fit: collapses empty columns, stretching existing elements */
.card-grid-fit {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}
```

This single line of CSS implements a responsive card layout without writing a single media query!

## Spanning Rows and Columns

```css
/* Make an element span 2 columns and 2 rows */
.featured-card {
  grid-column: span 2; /* span 2 columns */
  grid-row: span 2; /* span 2 rows */
}

/* Precise positioning */
.banner {
  grid-column: 1 / 3; /* from line 1 to line 3 */
  grid-row: 1 / 2;
}
```

## Masonry Layout (Approximation)

```css
/* CSS Grid masonry is still in draft; simulate with multi-column */
.masonry {
  column-count: 3;
  column-gap: 16px;
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
}
```

## Alignment Control

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);
```
