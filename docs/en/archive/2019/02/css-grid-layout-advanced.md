---
title: "Advanced CSS Grid Layout: Named Grid Lines and Template Areas"
date: 2019-02-13 17:08:59
tags:
  - CSS
readingTime: 1
description: "After using CSS Grid at work for a while, I've noticed that most developers stop at basic `grid-template-columns: repeat(3, 1fr)` and go no further. Named grid "
---

After using CSS Grid at work for a while, I've noticed that most developers stop at basic `grid-template-columns: repeat(3, 1fr)` and go no further. Named grid lines and template areas are what truly make Grid a killer for complex layouts.

## Named Grid Lines

Naming grid lines lets you place elements in a semantic way:

```css
.layout {
  display: grid;
  grid-template-columns:
    [sidebar-start] 240px
    [sidebar-end content-start] 1fr
    [content-end];
  grid-template-rows:
    [header-start] 60px
    [header-end main-start] auto
    [main-end footer-start] 48px
    [footer-end];
}

.header {
  grid-column: sidebar-start / content-end;
  grid-row: header-start / header-end;
}
.sidebar {
  grid-column: sidebar-start / sidebar-end;
  grid-row: main-start / main-end;
}
.content {
  grid-column: content-start / content-end;
  grid-row: main-start / main-end;
}
.footer {
  grid-column: sidebar-start / content-end;
  grid-row: footer-start / footer-end;
}
```

## grid-template-areas

Template areas are the most readable way to define a Grid layout — the ASCII art is the layout diagram:

```css
.layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content content"
    "footer  footer  footer";
  grid-template-columns: 240px 1fr 1fr;
  grid-template-rows: 60px auto 48px;
  min-height: 100vh;
}

.header {
  grid-area: header;
}
.sidebar {
  grid-area: sidebar;
}
.content {
  grid-area: content;
}
.footer {
  grid-area: footer;
}
```

### Responsive Layout

```css
@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "content"
      "sidebar"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
}
```

## Auto-Fill and Auto Placement

```css
/* Auto column count, minimum 200px */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

/* Difference between auto-fill and auto-fit */
/* auto-fill: fills as many columns as possible, may have empty columns on small screens */
/* auto-fit: stretches existing elements to fill the container */
```

## subgrid (CSS Grid Level 2)

subgrid was a hot proposal in 2019, allowing child grids to share the parent grid's track definitions:

```css
/* Very useful for aligning content within card groups */
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card {
  display: grid;
  /* grid-row: span 3; combined with subgrid for content alignment */
```
