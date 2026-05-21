---
title: "CSS Grid Layout Guide: From Flexbox to Grid Thinking"
date: 2018-01-06 14:39:49
tags:
  - CSS
readingTime: 1
description: "CSS Grid solves layout problems that Flexbox can't handle cleanly. Flexbox is one-dimensional (either rows or columns); Grid is two-dimensional (rows AND column"
wordCount: 121
---

CSS Grid solves layout problems that Flexbox can't handle cleanly. Flexbox is one-dimensional (either rows or columns); Grid is two-dimensional (rows AND columns simultaneously).

## Core Concepts

```css
.container {
  display: grid;
  grid-template-columns: 200px 1fr 1fr; /* 3 columns: fixed + 2 flexible */
  grid-template-rows: auto;
  gap: 16px; /* row-gap + column-gap */
}
```

The `fr` unit means "fraction of remaining space", similar to `flex: 1`.

## Admin Layout with grid-template-areas

```css
.layout {
  display: grid;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr 40px;
  min-height: 100vh;
}

.header {
  grid-area: header;
}
.sidebar {
  grid-area: sidebar;
}
.main {
  grid-area: main;
}
.footer {
  grid-area: footer;
}
```

The visual ASCII art in `grid-template-areas` makes the layout immediately readable.

## Responsive Cards with auto-fill + minmax

```css
.card-grid {
  display: grid;
  /* auto-fill: create as many columns as fit
     minmax(260px, 1fr): each column at least 260px, grow as needed */
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

This is responsive **without any media queries**. Resize the browser and columns automatically increase or decrease.

## Spanning Items

```css
/* Make an item span 2 columns and 2 rows */
.featured {
  grid-column: span 2;
  grid-row: span 2;
}

/* Precise placement */
.sidebar {
  grid-column: 1 / 2; /* column 1 to column 2 (line numbers) */
  grid-row: 1 / 3; /* row 1 to row 3 */
}
```

## Alignment

```css
.container {
  justify-items: center; /* horizontal alignment of all items */
  align-items: center; /* vertical alignment of all items */
}

/* Override for a single item */
.item {
  justify-self: end;
  align-self: start;
}

/* Center-align content in the grid container itself */
.container {
  justify-content: center; /* horizontal position of the grid */
  align-content: center; /* vertical position of the grid */
}
```

## When to Use Grid vs Flexbox

- **Grid**: overall page layout, two-dimensional layouts (rows and columns)
- **Flexbox**: one-dimensional layouts (navigation bar, button groups, single row/column of items)

In practice they're often used together: Grid for the page scaffold, Flexbox for items inside each cell.
