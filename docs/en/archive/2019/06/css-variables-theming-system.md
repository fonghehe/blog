---
title: "CSS Custom Properties (Variables) in Practice"
date: 2019-06-21 10:26:38
tags:
  - CSS
readingTime: 1
description: "CSS Custom Properties (also called CSS Variables) are now supported across major browsers. They are more flexible than Sass variables because they can be update"
wordCount: 67
---

CSS Custom Properties (also called CSS Variables) are now supported across major browsers. They are more flexible than Sass variables because they can be updated at runtime.

## Basic Usage

```css
/* Declaration: -- prefix, typically in :root */
:root {
  --color-primary: #409eff;
  --color-success: #67c23a;
  --color-danger: #f56c6c;

  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  --border-radius: 4px;
  --font-size-base: 14px;
}

/* Usage: var() function */
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius);
}

/* With default value */
.card {
  color: var(--card-color, #333); /* if --card-color is not defined, use #333 */
}
```

## Theme Switching (Core Use Case)

```css
/* Default theme (light) */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --border-color: #e8e8e8;
}

/* Dark theme */
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e8e8e8;
  --border-color: #333333;
}

/* Components use variables — automatically updated on theme change */
body {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.card {
  border: 1px solid var(--border-color);
  background: var(--bg-color);
}
```

```javascript
// Toggle theme
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "light" : "dark",
  );
  localStorage.setItem("theme", isDark ? "light" : "dark");
}

// Initialize (read user preference)
const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");
document.documentElement.setAttribute("data-theme", savedTheme);
```

## Updating Variables with JavaScript

```javascript
// Set a CSS variable globally
document.documentElement.style.setProperty("--primary-color", "#ff6b6b");

// Set on a specific element
element.style.setProperty("--card-width", "300px");

// Read a CSS variable value
const primary = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();
```

CSS Custom Properties are one of the few CSS features that truly bridge CSS and JavaScript — leverage them for dynamic theming, component customization, and runtime design token updates.
