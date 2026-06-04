---
title: "CSS Container Queries 2026: Component-Level Responsive Design"
date: 2026-06-04 16:38:53
tags:
  - CSS
readingTime: 2
description: "Container queries let components adjust layout based on their own container size instead of viewport width. This article discusses 2026 container query practical usage, common pitfalls, and strategies with Grid and Flex."
wordCount: 287
---

CSS Container Queries represent a paradigm shift in responsive design. Traditional media queries are based on viewport width, but components in practice often don't know how wide the container they'll be placed in will be. Container queries solve this—letting components adjust styles based on "their own environment."

## Basic Syntax

Container queries' core is two properties: `container-type` and `@container`:

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

`container-type` has three values:
- `inline-size`: Only monitors inline direction size changes (most common)
- `size`: Monitors both inline and block directions
- `normal`: Not a container query target

## Container Queries vs Media Queries

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| Page layout | Media queries | Viewport width determines layout |
| Card components | Container queries | Cards have different widths in different containers |
| Navigation bar | Media queries | Usually controlled by viewport width |
| Form components | Container queries | Forms may be in sidebar or main content |
| Hide/show elements | Media queries | Usually determined by viewport |

Principle: **Component needs to adapt to environment → Container queries; Page layout → Media queries**.

## Real Case: Adaptive Card

```css
.card-wrapper {
  container-type: inline-size;
}

/* Narrow container: vertical layout */
@container (max-width: 300px) {
  .card { flex-direction: column; }
}

/* Medium container: horizontal layout */
@container (min-width: 301px) and (max-width: 600px) {
  .card { flex-direction: row; }
  .card-image { width: 120px; flex-shrink: 0; }
}

/* Wide container: horizontal layout, larger image */
@container (min-width: 601px) {
  .card { flex-direction: row; }
  .card-image { width: 200px; flex-shrink: 0; }
}
```

## Container Query Units

```css
.card-title {
  /* cqi: 1% of container inline size */
  font-size: clamp(1rem, 3cqi, 1.5rem);
}
```

Units list:
- `cqw`: 1% of container width
- `cqh`: 1% of container height
- `cqi`: 1% of container inline size
- `cqb`: 1% of container block size
- `cqmin`: smaller of cqi and cqb
- `cqmax`: larger of cqi and cqb

## Common Pitfalls

**Pitfall 1: Forgetting to set container-type**

```css
/* Error: no container type declared */
.sidebar { width: 300px; }

@container (min-width: 400px) {
  .sidebar .widget { /* This rule won't work */ }
}
```

**Pitfall 2: Container query nesting**

Nested containers need `container-name` to explicitly specify query targets.

**Pitfall 3: Container queries don't support style queries**

In 2026, container queries can only query size, not styles (like font size, color).

## Progressive Enhancement Strategy

```css
/* Base style (doesn't rely on container queries) */
.card { display: flex; flex-direction: column; }

/* Container query enhancement */
@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## Summary

Container queries let components truly achieve "self-adaptation," no longer depending on viewport width. It's the final piece of responsive design—page layout uses media queries, component internals use container queries. Combined with Grid and Flex, you can build truly flexible component systems.
