---
title: "Advanced CSS Custom Properties"
date: 2019-05-15 11:24:19
tags:
  - CSS
readingTime: 1
description: "CSS Custom Properties (also called CSS Variables) now have full support across modern browsers. Many people only know they can be used to define color variables"
---

CSS Custom Properties (also called CSS Variables) now have full support across modern browsers. Many people only know they can be used to define color variables, but their capabilities go far beyond that. This article covers advanced usage and practical tips for CSS Custom Properties.

## Basics Review

```css
/* Declaration: must start with -- */
:root {
  --primary-color: #3498db;
  --primary-dark: #2980b9;
  --font-size-base: 16px;
  --spacing-unit: 8px;
  --border-radius: 4px;
  --transition-speed: 0.3s;
}

/* Usage: via the var() function */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3);
  border-radius: var(--border-radius);
  transition: background-color var(--transition-speed) ease;
}

.button:hover {
  background-color: var(--primary-dark);
}
```

## Fallback Values

The `var()` function supports a second argument as a default value.

```css
/* If --primary-color is not defined, use #3498db */
.element {
  color: var(--primary-color, #3498db);
}

/* Fallbacks can be nested */
.element {
  /* Try --primary-color first, then --brand-color, then red */
  color: var(--primary-color, var(--brand-color, red));
}

/* Real-world: default value design for component libraries */
.card {
  --card-bg: var(--card-background, #ffffff);
  --card-shadow: var(--shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
  --card-radius: var(--border-radius, 8px);

  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  border-radius: var(--card-radius);
}

/* Override when needed, or use defaults */
.promo-card {
  --card-background: #fffbe6;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

## Combining calc() with Variables

This is one of the most powerful features of CSS Custom Properties.

```css
:root {
  --base-size: 16px;
  --scale-ratio: 1.25;
  --spacing: 8px;
  --column-count: 12;
}

/* Type scale using calc */
h1 {
  font-size: calc(
    var(--base-size) * var(--scale-ratio) * var(--scale-ratio) *
      var(--scale-ratio)
  );
}
h2 {
  font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio));
}
h3 {
  font-size: calc(var(--base-size) * var(--scale-ratio));
}

/* Grid system */
.col-6 {
  width: calc(6 / var(--column-count) * 100%);
}
.col-4 {
  width: calc(4 / var(--column-count) * 100%);
}
```

CSS Custom Properties are live values — they can be updated with JavaScript at runtime, enabling powerful dynamic theming and animation possibilities.
