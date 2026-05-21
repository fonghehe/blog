---
title: "Advanced CSS Grid — From grid-template-areas to Real-World Layouts"
date: 2019-07-08 11:22:58
tags:
  - CSS
readingTime: 3
description: "CSS Grid has been supported by mainstream browsers for quite some time. Most developers know the basics of `grid-template-columns` and `grid-template-rows`, but"
wordCount: 337
---

CSS Grid has been supported by mainstream browsers for quite some time. Most developers know the basics of `grid-template-columns` and `grid-template-rows`, but advanced features like `grid-template-areas`, `auto-fill` vs `auto-fit`, and `minmax()` are what really unlock Grid's power. This article walks through these features with practical layout examples.

## grid-template-areas: Describe Your Layout in Text

The traditional approach of specifying row and column numbers is hard to read. `grid-template-areas` lets you describe layout structure visually with text:

```css
.layout {
  display: grid;
  min-height: 100vh;
  grid-template-areas:
    "header  header  header"
    "sidebar content aside"
    "footer  footer  footer";
  grid-template-columns: 240px 1fr 200px;
  grid-template-rows: 60px 1fr 50px;
  grid-gap: 0;
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
.aside {
  grid-area: aside;
}
.footer {
  grid-area: footer;
}
```

The code is self-documenting — the layout structure matches the visual appearance.

### Responsive Layout with Media Queries

Combine with media queries to easily change the layout structure:

```css
.layout {
  display: grid;
  min-height: 100vh;
  grid-template-areas:
    "header  header"
    "sidebar content"
    "footer  footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr 50px;
}

.aside {
  display: none;
}

@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "content"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: 50px 1fr 50px;
  }

  .sidebar {
    display: none;
  }
}
```

### Using Dots for Empty Areas

Use `.` to indicate empty areas:

```css
.dashboard {
  display: grid;
  grid-template-areas:
    "stats  stats  chart"
    "table  table  chart"
    ".      .      chart";
  grid-template-columns: 1fr 1fr 300px;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
}
```

## auto-fill vs auto-fit

These two values look similar but behave completely differently. Both are used in `grid-template-columns` to automatically determine the number of columns when the container size is uncertain.

### auto-fill

```css
.grid-auto-fill {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fill` creates as many column tracks as possible, even without enough children to fill them. If the container is 800px wide and each column minimum is 200px, it creates 4 column tracks. Even with only 2 children, the 3rd and 4th empty tracks still exist (though invisible).

### auto-fit

```css
.grid-auto-fit {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fit` collapses empty column tracks to 0 width when children don't fill the row, allowing existing children to stretch and fill the remaining space.

### Visual Comparison

With an 800px-wide container, 200px minimum column width, and only 2 children:

```
auto-fill (4 columns, 2 empty columns retained):
+--------+--------+--------+--------+
|  item1 |  item2 |  empty |  empty |
+--------+--------+--------+--------+

auto-fit (2 columns, empty collapsed, items stretch):
+--------------------+--------------------+
|       item1        |       item2        |
+--------------------+--------------------+
```

Practical guidance:

- For **product lists and card layouts**, `auto-fit` usually matches expectations
- For **grid galleries** where fixed cell positions are needed, use `auto-fill`

## The Power of minmax()

`minmax()` defines a size range, and works great combined with `auto-fill`/`auto-fit`:

```css
/* Adaptive cards: minimum 280px, max fills evenly */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* Table scenario: first column fixed, rest adaptive */
.data-table {
  display: grid;
  grid-template-columns: 60px minmax(200px, 2fr) minmax(100px, 1fr) minmax(
      80px,
      0.5fr
    );
}
```

`minmax()` parameters:

- First argument: minimum value
- Second argument: maximum value
- Can use `px`, `em`, `fr`, `auto`, `min-content`, `max-content`

## Practice: Responsive Dashboard Layout

An admin dashboard page with stats cards, charts, and data tables:

```html
<div class="dashboard">
  <div class="card card-stat" data-area="stat1">
    <div class="card__value">1,234</div>
    <div class="card__label">Today's Visits</div>
  </div>
  <div class="card card-stat" data-area="stat2">
    <div class="card__value">567</div>
    <div class="card__label">New Users</div>
  </div>
  <div class="card card-stat" data-area="stat3">
    <div class="card__value">89%</div>
    <div class="card__label">Conversion Rate</div>
  </div>
  <div class="card card-stat" data-area="stat4">
    <div class="card__value">12,345</div>
    <div class="card__label">Today's Revenue</div>
  </div>
  <div class="card card-chart" data-area="chart">
    <h3>Traffic Trend</h3>
    <div class="chart-placeholder">Chart Area</div>
  </div>
  <div class="card card-table" data-area="table">
    <h3>Recent Orders</h3>
    <table>
      <!-- ... -->
    </table>
  </div>
</div>
```

```css
.dashboard {
  display: grid;
  gap: 20px;
  padding: 20px;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  grid-template-areas:
    "stat1 stat2 stat3 stat4"
    "chart chart table table";
}

[data-area="stat1"] {
  grid-area: stat1;
}
[data-area="stat2"] {
  grid-area: stat2;
}
[data-area="stat3"] {
  grid-area: stat3;
}
[data-area="stat4"] {
  grid-area: stat4;
}
[data-area="chart"] {
  grid-area: chart;
}
[data-area="table"] {
  grid-area: table;
}

@media (max-width: 1024px) {
  .dashboard {
    grid-template-columns: repeat(2, 1fr);
    grid-template-areas:
      "stat1 stat2"
      "stat3 stat4"
      "chart chart"
      "table table";
  }
}

@media (max-width: 640px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas:
      "stat1"
      "stat2"
      "stat3"
      "stat4"
      "chart"
      "table";
  }
}
```

## Summary

- `grid-template-areas` improves layout readability significantly
- `auto-fit` is better for cards; `auto-fill` is better for fixed grids
- `minmax()` is the foundation of responsive layouts
- Grid combined with media queries enables clean responsive design without extra wrappers
