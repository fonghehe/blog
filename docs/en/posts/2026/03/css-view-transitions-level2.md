---
title: "CSS View Transitions Level 2: Cross-Document Animation in Practice"
date: 2026-03-27 16:21:58
tags:
  - CSS
readingTime: 2
description: "CSS View Transitions Level 1 brought elegant page-transition animations to single-page applications (SPAs). **View Transitions Level 2**, which landed in all ma"
wordCount: 272
---

CSS View Transitions Level 1 brought elegant page-transition animations to single-page applications (SPAs). **View Transitions Level 2**, which landed in all major browser stable channels in 2026, extends that capability to multi-page applications (MPAs) — no JavaScript framework required. Pure CSS + HTML is all you need for smooth cross-document transition animations.

## Level 1 Recap: View Transitions in SPAs

Before Level 2, SPA frameworks typically used View Transitions like this:

```typescript
// Route transition animation in React Router / Next.js
async function navigate(url: string) {
  if (!document.startViewTransition) {
    window.location.href = url;
    return;
  }

  await document.startViewTransition(async () => {
    await router.push(url);
  });
}
```

```css
/* Default cross-fade */
::view-transition-old(root) {
  animation: 200ms ease-out fade-out;
}
::view-transition-new(root) {
  animation: 200ms ease-in fade-in;
}
```

## Level 2: Cross-Document Transitions in MPAs

The core breakthrough in Level 2 is enabling seamless navigation animations on ordinary multi-page websites with a single CSS declaration:

```css
/* Add to your global styles inside <head> */
@view-transition {
  navigation: auto; /* Tell the browser to enable view transitions for normal navigation */
}
```

That single line gives every page navigation an automatic cross-fade.

## Named Element Transitions: Hero Animations

Level 2's most powerful feature is the cross-document "hero animation" — a continuous transition of the same element between different pages:

```css
/* List page: name the product card */
.product-card[data-id="42"] {
  view-transition-name: product-42;
}

/* Or generate names dynamically with CSS custom properties */
.product-card {
  view-transition-name: var(--product-id);
}
```

```html
<!-- List page -->
<div class="product-card" style="--product-id: product-42" data-id="42">
  <img src="product-42.jpg" alt="Product image" />
  <h2>Product name</h2>
</div>

<!-- Detail page: use the same view-transition-name -->
<div class="product-hero" style="view-transition-name: product-42">
  <img src="product-42.jpg" alt="Product image" />
</div>
```

The browser automatically calculates the position and size difference between the two elements and generates a smooth FLIP animation.

## Fine-Grained Transition Control

```css
/* Transition targeting a specific named element */
::view-transition-old(product-42) {
  animation: 300ms ease-in scale-out;
}
::view-transition-new(product-42) {
  animation: 300ms ease-out scale-in;
}

@keyframes scale-out {
  to {
    transform: scale(1.1);
    opacity: 0;
  }
}
@keyframes scale-in {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
}

/* Slide effect for other elements */
::view-transition-old(root) {
  animation: 250ms ease-out slide-left;
}
::view-transition-new(root) {
  animation: 250ms ease-out slide-right;
}
```

## Respecting User Preferences

```css
/* Honour the user's reduced-motion preference */
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: auto;
  }

  /* Fall back to a simple fade or disable entirely */
  ::view-transition-group(*) {
    animation-duration: 0.01ms !important;
  }
}
```

## Integration with Next.js / Nuxt

Using Next.js App Router as an example:

```typescript
// app/layout.tsx
import './view-transitions.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Level 2 MPA mode is enabled via CSS — no extra JS needed */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* view-transitions.css */
@view-transition {
  navigation: auto;
}

/* Default page-level animation */
::view-transition-old(root) {
  animation: 200ms ease-out both fade-slide-out;
}
::view-transition-new(root) {
  animation: 200ms ease-out both fade-slide-in;
}

@keyframes fade-slide-out {
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
```

## Browser Support (Early 2026)

| Browser      | Level 1 | Level 2 (Cross-Document) |
| ------------ | ------- | ------------------------ |
| Chrome 133+  | ✅      | ✅                       |
| Firefox 132+ | ✅      | ✅                       |
| Safari 18.3+ | ✅      | ✅                       |
| Edge 133+    | ✅      | ✅                       |

By early 2026, global browser coverage exceeds 92%. You can confidently ship this in production, using `@supports` as a progressive enhancement fallback.

## Conclusion

CSS View Transitions Level 2 fills the last remaining gap in multi-page application animation. No JavaScript framework, no manual animation state management — just a handful of CSS declarations to give your website page transitions that rival native apps. For any new MPA project started in 2026, this should be an enabled-by-default baseline feature.
