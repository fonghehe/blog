---
title: "CSS Custom Properties Advanced: ThemingSwitching & DynamicStyles"
date: 2018-02-27 16:32:20
tags:
  - CSS
readingTime: 2
description: "CSS custom properties (also called CSS variables) are now supported in all major browsers, except IE. They're fundamentally different from Sass variables and ha"
wordCount: 266
---

CSS custom properties (also called CSS variables) are now supported in all major browsers, except IE. They're fundamentally different from Sass variables and have their own unique advantages worth understanding properly.

## Basic Syntax

```css
/* Define variables: prefix with -- */
:root {
  --primary-color: #409eff;
  --font-size-base: 14px;
  --spacing-md: 16px;
}

/* Use variables: var() function */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: var(--spacing-md);
}

/* Can provide a fallback value */
.text {
  color: var(--text-color, #333); /* uses #333 if --text-color is undefined */
}
```

## The Fundamental Difference from Sass Variables

Sass variables are compile-time and disappear after compilation:

```scss
// Sass variable
$primary: #409eff;
.btn {
  color: $primary;
}

// Compiled output
.btn {
  color: #409eff;
}
// The variable no longer exists at runtime — can't be changed dynamically
```

CSS variables exist at runtime:

```css
/* CSS variables live at runtime and can be changed dynamically */
:root { --primary: #409eff; }
.btn { color: var(--primary); }

/* JavaScript can modify them */
document.documentElement.style.setProperty('--primary', '#67c23a')
/* All elements using var(--primary) update immediately */
```

This is the biggest advantage of CSS variables: **runtime dynamic modification**.

## Use Case 1: Theme Switching

Before CSS variables, implementing theme switching required either pre-compiling multiple CSS files or swapping classes with JavaScript. CSS variables make it much simpler:

```css
/* Define themes */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --primary: #409eff;
}

[data-theme="dark"] {
  --bg-color: #1a1a2e;
  --text-color: #e0e0e0;
  --primary: #64b5f6;
}

/* All components only use variables — no hard-coded colors */
body {
  background: var(--bg-color);
  color: var(--text-color);
}
```

```javascript
// Switch themes
document.documentElement.setAttribute("data-theme", "dark");
document.documentElement.setAttribute("data-theme", "light");
```

## Use Case 2: Dynamic Spacing/Sizing

In responsive layouts, spacing can change with screen size:

```css
:root {
  --spacing: 16px;
}

@media (max-width: 768px) {
  :root {
    --spacing: 8px;
  }
}

.card {
  padding: var(--spacing);
  margin-bottom: var(--spacing);
}

.card-header {
  padding: calc(var(--spacing) / 2) var(--spacing);
}
```

## Use Case 3: Component-level Variables (Local Scope)

CSS variables follow CSS inheritance rules and can be overridden within a component:

```css
/* Global defaults */
:root {
  --button-bg: #409eff;
  --button-radius: 4px;
}

/* Override within a specific context */
.danger-zone {
  --button-bg: #f56c6c;
}

/* All buttons inside .danger-zone will use the red background */
.button {
  background: var(--button-bg);
  border-radius: var(--button-radius);
}
```

This pattern is especially useful for component library theme customization:

```css
/* Users can override a component's default style variables */
.my-app {
  --el-color-primary: #722ed1; /* Custom Element UI theme color */
}
```

## Using CSS Variables with Sass

In real projects you can combine both: Sass handles compile-time logic (loops, conditionals, functions); CSS variables handle runtime dynamism.

```scss
// Use Sass to generate CSS variables in bulk
$colors: (
  "primary": #409eff,
  "success": #67c23a,
  "warning": #e6a23c,
  "danger": #f56c6c,
);

:root {
  @each $name, $value in $colors {
    --color-#{$name}: #{$value};
  }
}
```

## Reading and Writing CSS Variables with JavaScript

```javascript
// Read
const value = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();

// Set
document.documentElement.style.setProperty("--primary-color", "#67c23a");

// Delete (restores the inherited value)
document.documentElement.style.removeProperty("--primary-color");

// Set locally within a component
element.style.setProperty("--button-size", "32px");
```

## Browser Support

As of early 2018, all major browsers support CSS variables: Chrome 49+, Firefox 31+, Safari 9.1+, Edge 15+. Only IE is unsupported.

If IE support is required, use `postcss-custom-properties` to replace variables with concrete values at compile time (losing the dynamic capability, but ensuring compatibility).

## Summary

- The core value of CSS variables is **runtime dynamism** — something Sass variables cannot provide
- Theme switching, responsive design, and component theme customization are the best use cases
- Variables follow CSS inheritance rules and can be overridden at any scope
- Combine with Sass: Sass for compile-time logic, CSS variables for runtime flexibility
