---
title: "CSS Style Queries in Practice: Driving Component Variants with Custom Properties"
date: 2026-08-21 14:06:19
tags:
  - CSS
readingTime: 5
description: "CSS Style Queries (@container style(...)) reached Baseline 2026, finally enabling styles based on custom property values. This article focuses on practical usage: theme switching without classes, component variants driven by custom properties, integration with @property, and fallback strategies."
wordCount: 749
---

Container Queries solved the problem of "responding to container dimensions," but they have a blind spot: you can't change child component styles based on container state (such as current theme, density mode, or brand color). Until now, we either piled on classes (`.dark`, `.compact`, `.brand-acme`) or computed values in JS and passed them as props. Style Queries fill this gap — they let you query custom property values directly with `@container style(...)`, returning variant control to CSS.

## Style Queries Basic Syntax

Style Queries syntax mirrors Size Container Queries, but the query target shifts from dimensions to custom properties:

```css
/* Declare a style query container */
.card-wrapper {
  container-type: normal; /* Style queries don't require size containment */
}

/* When --theme equals dark */
@container style(--theme: dark) {
  .card {
    background: #1a1a2e;
    color: #e0e0e0;
    border-color: #333;
  }
}

/* When --density equals compact */
@container style(--density: compact) {
  .card {
    padding: 8px 12px;
    font-size: 0.875rem;
  }
}
```

Note `container-type: normal` — style queries don't need `size` or `inline-size` because they query property values, not dimensions. This means you can set a style container on any element without triggering layout constraints.

## Theme Switching: Goodbye Global .dark Class

The traditional dark theme approach adds a `.dark` class to `<html>` and overrides all colors via descendant selectors. The problem arises when a page needs both light and dark theme regions simultaneously (e.g., embedded widgets, preview panels) — a global class can't handle that.

With Style Queries, theme scope follows the container:

```css
/* Register custom property to ensure correct typing */
@property --theme {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: light;
}

/* Theme container */
.theme-scope {
  container-type: normal;
  --theme: light;
}

.theme-scope[data-theme="dark"] {
  --theme: dark;
}

/* Component styles switch automatically based on container theme */
@container style(--theme: dark) {
  .button {
    background: var(--color-primary-dark);
    color: #fff;
  }

  .input {
    background: #2a2a3e;
    border-color: #444;
    color: #eee;
  }
}

@container style(--theme: light) {
  .button {
    background: var(--color-primary);
    color: #fff;
  }

  .input {
    background: #fff;
    border-color: #ddd;
    color: #333;
  }
}
```

```html
<!-- Two different theme regions on the same page -->
<div class="theme-scope" data-theme="light">
  <div class="card">Card in light region</div>
</div>

<div class="theme-scope" data-theme="dark">
  <div class="card">Card in dark region</div>
</div>
```

The key here is `inherits: true`. `--theme` inherits down the DOM tree, so you only need to set it once at the container level — all child components inside can sense it via style queries. Much cleaner than binding classes on every component.

## Component Variants Driven by Custom Properties

The most valuable use case for Style Queries is freeing component variants from combinatorial class explosion. Take a Card component with three dimensions: size (small/medium/large), tone (neutral/accent/warning), and density (comfortable/compact). Class combinations would need 3x3x3 = 27 selectors; custom properties + style queries handle each dimension independently.

```css
/* Register variant properties */
@property --card-size {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: medium;
}

@property --card-tone {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: neutral;
}

@property --card-density {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: comfortable;
}

/* Base styles */
.card {
  container-type: normal;
  border-radius: 8px;
  transition: all 0.2s ease;
}

/* === Size dimension === */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-size: medium) {
  .card { padding: 20px; font-size: 0.9375rem; }
}
@container style(--card-size: large) {
  .card { padding: 28px; font-size: 1.0625rem; }
}

/* === Tone dimension === */
@container style(--card-tone: neutral) {
  .card { background: var(--surface-1); border: 1px solid var(--border-subtle); }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border: 1px solid var(--color-primary); }
}
@container style(--card-tone: warning) {
  .card { background: var(--surface-warning); border: 1px solid var(--color-warning); }
}

/* === Density dimension === */
@container style(--card-density: compact) {
  .card { gap: 4px; line-height: 1.4; }
  .card__actions { margin-top: 8px; }
}
@container style(--card-density: comfortable) {
  .card { gap: 12px; line-height: 1.6; }
  .card__actions { margin-top: 16px; }
}
```

The consumer side only needs to set property values:

```html
<div style="--card-size: large; --card-tone: accent; --card-density: compact;">
  <div class="card">
    <h3>Large accent compact card</h3>
    <p>Three dimensions controlled independently, no class combinations.</p>
  </div>
</div>
```

In Vue / React components, these custom properties map through props:

```vue
<template>
  <div
    :style="{
      '--card-size': size,
      '--card-tone': tone,
      '--card-density': density,
    }"
  >
    <div class="card">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
  tone?: 'neutral' | 'accent' | 'warning'
  density?: 'compact' | 'comfortable'
}>()
</script>
```

The component template contains zero variant logic — all visual differences are handled by CSS style queries. Design system updates only touch CSS, not component code.

## Working with @property: Why Registration Matters

All examples above use `@property` to register custom properties. This isn't optional — without registration, browsers treat custom properties as untyped strings, and style query matching behavior may not meet expectations.

Specifically:

| Feature | Unregistered Property | After @property Registration |
|---------|----------------------|------------------------------|
| Syntax validation | None | Validated against syntax |
| Inheritance behavior | Inherits by default | Controlled by inherits |
| Initial value | None (empty won't match) | Has initial-value |
| Animation support | Not supported | Interpolated per syntax |
| Style Query matching | Exact string match only | Typed matching |

A common pitfall: if an unregistered property has an empty value (e.g., some ancestor didn't set it), the style query won't match any branch, and the component falls back to base styles. With registration and `initial-value`, there's always a definite match target.

```css
/* Register as non-inheriting with initial value */
@property --card-highlight {
  syntax: '<color>';
  inherits: false;
  initial-value: transparent;
}

/* Only applies in containers where highlight color is explicitly set */
@container style(--card-highlight) {
  .card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--card-highlight);
  }
}
```

Here `@container style(--card-highlight)` without a colon and value means "match as long as the property exists and isn't the initial value." This is a convenient shorthand for toggle-style variants.

## Fallback Strategies: What If Style Queries Aren't Supported

As of August 2026, Style Queries are Baseline Newly Available, supported in Chrome 136+, Firefox 138+, and Safari 18.4+. But some users remain on older versions, so fallback plans should be considered upfront.

**Strategy 1: @supports detection + class fallback**

```css
/* Modern browsers: use style queries */
@supports (container-type: normal) and (style(--theme: dark)) {
  @container style(--theme: dark) {
    .card { background: #1a1a2e; color: #e0e0e0; }
  }
}

/* Fallback: use traditional classes */
@supports not ((container-type: normal) and (style(--theme: dark))) {
  .theme-dark .card { background: #1a1a2e; color: #e0e0e0; }
}
```

**Strategy 2: Progressive enhancement — base styles as safety net**

Make the most common variant the default style, and let style queries only provide enhancements. Even without support, the component has a usable appearance:

```css
/* Default = neutral + medium + comfortable */
.card {
  padding: 20px;
  font-size: 0.9375rem;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
}

/* Style queries override non-default values */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border-color: var(--color-primary); }
}
```

I recommend Strategy 2. It doesn't require maintaining two sets of selectors, and the degraded experience simply reverts to the default appearance rather than breaking entirely. For public-facing content sites, this trade-off is acceptable.

## Combining with Size Container Queries

Style Queries and Size Container Queries can stack on the same container:

```css
.card-wrapper {
  container-type: inline-size; /* Supports both size and style queries */
  --card-tone: neutral;
}

/* Narrow container + accent tone */
@container (max-width: 300px) and style(--card-tone: accent) {
  .card {
    flex-direction: column;
    border-left: none;
    border-top: 3px solid var(--color-primary);
  }
}

/* Wide container + accent tone */
@container (min-width: 301px) and style(--card-tone: accent) {
  .card {
    flex-direction: row;
    border-top: none;
    border-left: 3px solid var(--color-primary);
  }
}
```

This combination capability is nearly impossible to achieve elegantly with classes — you'd need a separate class for every size-x-state combination, while CSS expresses this two-dimensional relationship natively.

## Summary

Style Queries fill a critical gap in CSS conditional styling: responsive design based on state rather than dimensions. In real projects, its greatest value is eliminating combinatorial class explosion and reducing style logic in the JS layer. Pair it with `@property` registration for type safety, `@supports` for graceful degradation, and Size Container Queries for multi-dimensional responsiveness. If your design system still manages variants through heavy modifier classes, Style Queries are a worthwhile refactoring direction. They aren't a silver bullet replacing all existing approaches, but for component variant management and scoped theme switching, they're more direct than any pure CSS solution that came before.
