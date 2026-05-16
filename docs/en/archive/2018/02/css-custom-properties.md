---
title: "CSS Custom Properties (Variables) Practical Guide"
date: 2018-02-27 16:32:20
tags:
  - CSS
readingTime: 1
description: "CSS custom properties (also called CSS variables) are different from Sass/Less variables in a fundamental way: they're resolved at **runtime** in the browser, n"
---

CSS custom properties (also called CSS variables) are different from Sass/Less variables in a fundamental way: they're resolved at **runtime** in the browser, not at compile time. This enables things that preprocessors simply cannot do.

## Basic Syntax

```css
/* Definition: must start with -- */
:root {
  --primary-color: #4285f4;
  --spacing-md: 16px;
  --border-radius: 4px;
}

/* Usage: var() function */
.button {
  background-color: var(--primary-color);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
}

/* Fallback value */
.text {
  color: var(--text-color, #333); /* use #333 if --text-color is undefined */
}
```

## The Key Difference from Sass Variables

```scss
// Sass: compile-time variable — becomes a fixed value in the CSS output
$primary: #4285f4;
.button {
  background: $primary;
} // → .button { background: #4285f4; }

// After compilation, you can't dynamically change it in the browser
```

```javascript
// CSS variable: live in the browser, changeable at runtime
document.documentElement.style.setProperty("--primary-color", "#ff5722");
// Every element using var(--primary-color) updates instantly!
```

## Dark Mode Theme Switching

```css
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --card-bg: #f5f5f5;
}

[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e0e0e0;
  --card-bg: #2d2d2d;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
}
.card {
  background: var(--card-bg);
}
```

```javascript
// Toggle theme
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute(
    "data-theme",
    current === "dark" ? "light" : "dark",
  );
}
```

No JavaScript is needed to restyle every element. Just change one attribute and the entire page updates through CSS variables.

## Component-Level Variables

CSS variables can be scoped to a component, not just the global `:root`:

```css
/* Component defaults */
.card {
  --card-padding: 16px;
  --card-radius: 8px;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  padding: var(--card-padding);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
}

/* Override at use site */
.product-card {
  --card-padding: 24px;
  --card-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

## Combining with Sass

```scss
// Use Sass for compile-time constants (design tokens)
$colors: (
  "primary": #4285f4,
  "danger": #f44336,
);

// Generate CSS variables from Sass map
:root {
  @each $name, $value in $colors {
    --color-#{$name}: #{$value};
  }
}

// Use CSS variables in components (now runtime-changeable)
.button {
  background: var(--color-primary);
}
```

## Reading/Writing from JavaScript

```javascript
// Read a CSS variable
const style = getComputedStyle(document.documentElement);
const primaryColor = style.getPropertyValue("--primary-color").trim();

// Write (affects all elements inheriting this variable)
document.documentElement.style.setProperty("--primary-color", "#ff5722");

// Write on a specific element (scoped)
element.style.setProperty("--card-bg", "#f0f0f0");
```
