---
title: "The Complete CSS Flexbox Layout Guide"
date: 2018-06-14 17:13:56
tags:
  - CSS
readingTime: 1
description: "Flexbox is the most commonly used layout method today, but some properties are always hard to remember. Here's a quick-reference cheatsheet."
---

Flexbox is the most commonly used layout method today, but some properties are always hard to remember. Here's a quick-reference cheatsheet.

## Container Properties

```css
.container {
  display: flex; /* or inline-flex */

  /* Main axis direction */
  flex-direction: row; /* → default */
  flex-direction: row-reverse; /* ← */
  flex-direction: column; /* ↓ */
  flex-direction: column-reverse; /* ↑ */

  /* Wrapping */
  flex-wrap: nowrap; /* no wrap (default) */
  flex-wrap: wrap; /* wrap downward */
  flex-wrap: wrap-reverse; /* wrap upward */

  /* Main axis alignment (justify-content) */
  justify-content: flex-start; /* left/top align (default) */
  justify-content: flex-end; /* right/bottom align */
  justify-content: center; /* center */
  justify-content: space-between; /* equal gaps between items */
  justify-content: space-around; /* equal space on each side of items */
  justify-content: space-evenly; /* all gaps equal */

  /* Cross axis alignment (align-items) */
  align-items: stretch; /* stretch to fill (default) */
  align-items: flex-start; /* align to top */
  align-items: flex-end; /* align to bottom */
  align-items: center; /* center */
  align-items: baseline; /* baseline alignment */

  /* Multi-line alignment (align-content, only works when wrapping) */
  align-content: flex-start;
  align-content: space-between;

  /* gap (new property, replaces margin tricks) */
  gap: 16px; /* same gap for rows and columns */
  gap: 16px 24px; /* row-gap column-gap */
}
```

## Item Properties

```css
.item {
  /* Order */
  order: 0; /* default 0, lower value = earlier */

  /* Grow factor (when there's extra space) */
  flex-grow: 0; /* don't grow by default */
  flex-grow: 1; /* take up all remaining space */

  /* Shrink factor (when space is tight) */
  flex-shrink: 1; /* shrink proportionally by default */
  flex-shrink: 0; /* don't shrink */

  /* Initial size on main axis */
  flex-basis: auto; /* default: determined by content */
  flex-basis: 200px; /* specify base width */

  /* Shorthand: grow shrink basis */
  flex: 1; /* 1 1 0% */
  flex: auto; /* 1 1 auto */
  flex: none; /* 0 0 auto */
  flex: 0 0 200px; /* fixed 200px, no grow or shrink */

  /* Override container's align-items */
  align-self: center;
}
```

## Common Layout Patterns

```css
/* Center horizontally and vertically */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Left-right layout with fixed-width right sidebar */
.layout {
  display: flex;
}
.layout-main {
  flex: 1;
}
.layout-sidebar {
  width: 240px;
  flex-shrink: 0;
}

/* Sticky footer */
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
main {
  flex: 1;
} /* expands to push footer to the bottom */

/* Equal-height columns */
.columns {
  display: flex; /* default align-items: stretch makes columns equal height */
}

/* Responsive card grid (3 per row) */
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.card {
  flex: 0 0 calc(33.33% - 12px); /* subtract gap */
}
```

## Summary

- `justify-content` controls the main axis; `align-items` controls the cross axis
- `flex: 1` is the most common shorthand for equal distribution
- `gap` is much cleaner than using `margin` for spacing
- `flex-shrink: 0` prevents a fixed-width sidebar from being compressed
