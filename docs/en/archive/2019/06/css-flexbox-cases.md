---
title: "Complex Layout Cases with CSS Flexbox"
date: 2019-06-18 11:05:37
tags:
  - CSS
readingTime: 1
description: "There are plenty of articles on complex Flexbox layout cases online, but most lack real-world experience. This article explores best practices based on actual p"
wordCount: 77
---

There are plenty of articles on complex Flexbox layout cases online, but most lack real-world experience. This article explores best practices based on actual projects.

## Flexbox Fundamentals

```css
.container {
  display: flex;
  flex-direction: row; /* main axis direction: row (default) | column */
  flex-wrap: wrap; /* wrapping: nowrap (default) | wrap */
  justify-content: flex-start; /* main axis alignment */
  align-items: stretch; /* cross axis alignment */
  gap: 16px; /* spacing between items */
}
```

## Common Layout Patterns

### Equal-Width Columns

```css
.columns {
  display: flex;
  gap: 16px;
}
.columns > * {
  flex: 1; /* flex-grow: 1, flex-shrink: 1, flex-basis: 0% */
}
```

### Sticky Footer

```css
/* The footer is always at the bottom regardless of content length */
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
main {
  flex: 1; /* grows to fill available space */
}
footer {
  /* natural height */
}
```

### Holy Grail Layout (Header + Left Sidebar + Main + Right Sidebar + Footer)

```css
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.layout-body {
  display: flex;
  flex: 1;
}
.layout-sidebar-left {
  width: 200px;
  flex-shrink: 0;
}
.layout-main {
  flex: 1;
  min-width: 0;
} /* min-width:0 prevents overflow */
.layout-sidebar-right {
  width: 160px;
  flex-shrink: 0;
}
```

### Card Grid with Equal-Height Cards

```css
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.card {
  flex: 1 1 280px; /* minimum 280px, grows equally */
  display: flex;
  flex-direction: column;
}
.card-body {
  flex: 1; /* grows to fill remaining card height */
}
```

## Centering — the Most Common Use Case

```css
/* Centered both horizontally and vertically */
.centered {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Vertical centering for text + icon */
.inline-center {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
```

Flexbox is best for one-dimensional layouts (a single row or column). For two-dimensional layouts, consider CSS Grid.
