---
title: "Tailwind CSS 4: New Architecture Breakdown"
date: 2025-02-08 10:00:00
tags:
  - CSS
  - Engineering
readingTime: 2
description: "Tailwind CSS 4.0 has officially launched — a complete rewrite from the ground up. Let's talk about the architectural changes and migration considerations."
---

Tailwind CSS 4.0 has officially launched — a complete rewrite from the ground up. Let's talk about the architectural changes and migration considerations.

## Core Changes

```
Key changes from v3 → v4:
  1. Brand-new engine (Oxide), 10x faster builds
  2. CSS-first configuration — goodbye tailwind.config.js
  3. Native cascade layers support
  4. Automatic content detection — no more content configuration
  5. New variant syntax (@variant)
  6. CSS variables used throughout
```

## CSS-First Configuration

```css
/* v4: app.css — configure directly in CSS */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --font-sans: "Inter", system-ui, sans-serif;
  --breakpoint-3xl: 1920px;

  /* Custom spacing */
  --spacing-128: 32rem;
  --spacing-144: 36rem;

  /* Custom animation */
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

```js
// v3: tailwind.config.js — no longer needed
module.exports = {
  theme: {
    extend: {
      colors: { primary: "#3b82f6" },
    },
  },
  content: ["./src/**/*.{tsx,ts}"],
};
```

## Vite Integration

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(), // replaces postcss
  ],
});
```

Build speed is dramatically faster because it no longer goes through the PostCSS pipeline.

## Cascade Layers

```css
/* v4 automatically uses CSS cascade layers */
/* Priority order:
   1. base (reset styles)
   2. components (component styles)
   3. utilities (utility classes)
*/

/* Custom layer */
@layer components {
  .btn-primary {
    @apply bg-primary text-white px-4 py-2 rounded-lg;
    @apply hover:bg-primary/90 transition-colors;
  }
}
```

This solves the `!important` proliferation problem — utility classes are naturally higher priority than component styles.

## New Variant Syntax

```html
<!-- Dark mode -->
<div class="bg-white dark:bg-gray-900">
  <!-- Responsive -->
  <p class="text-sm md:text-base lg:text-lg">Responsive text</p>
  <!-- Container queries -->
  <div class="@container">
    <div class="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3">
      <!-- Responds to container width -->
    </div>
  </div>
</div>
```

## Migration Guide

```bash
# 1. Install v4
npm install tailwindcss@latest @tailwindcss/vite@latest

# 2. Remove PostCSS config
rm postcss.config.js

# 3. Update CSS entry point
# Migrate tailwind.config.js content into the @theme block in CSS

# 4. Run the official migration tool
npx @tailwindcss/upgrade
```

## Working with shadcn/ui

```css
/* CSS variables compatible with shadcn/ui */
@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  /* ... more variables */
}
```

shadcn/ui still works fine under v4 — you just need to adjust how CSS variables are declared.

## Summary

- The core of Tailwind CSS 4 is improved performance and developer experience
- CSS-first configuration makes theme management more intuitive
- The Oxide engine makes builds 10x faster
- Cascade Layers solve the priority problem
- Integration with Vite is smoother than ever
- The migration tool is mature; most projects can migrate with a single command
