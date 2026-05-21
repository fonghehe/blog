---
title: "Responsive Design in Practice: Starting Mobile-First"
date: 2018-05-26 11:18:01
tags:
  - CSS
readingTime: 1
description: "After working on several mobile projects, here's a summary of responsive design best practices."
wordCount: 87
---

After working on several mobile projects, here's a summary of responsive design best practices.

## Mobile-First

Write mobile styles first, then use `min-width` media queries to progressively enhance for larger screens:

```css
/* ✅ Mobile-first */
.container {
  padding: 16px; /* default: phone */
}

@media (min-width: 768px) {
  .container {
    padding: 24px; /* tablet */
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px; /* desktop */
  }
}

/* ❌ Desktop-first (not recommended — too many overrides for mobile) */
.container {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 767px) {
  .container {
    max-width: 100%;
    padding: 16px;
  }
}
```

## Breakpoint Planning

```css
/* Common breakpoints (aligned with mainstream devices) */
/* Phone: < 576px (default, no media query needed) */
/* Large phone / small tablet: ≥ 576px */
/* Tablet: ≥ 768px */
/* Small desktop: ≥ 992px */
/* Large desktop: ≥ 1200px */

:root {
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 992px;
  --breakpoint-xl: 1200px;
}
```

## Responsive Flexbox

```css
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card {
  /* Phone: one per row */
  flex: 1 1 100%;
}

@media (min-width: 576px) {
  .card {
    /* Tablet: two per row */
    flex: 1 1 calc(50% - 8px);
  }
}

@media (min-width: 992px) {
  .card {
    /* Desktop: three per row */
    flex: 1 1 calc(33.333% - 11px);
  }
}
```

## Responsive Grid (Preferred)

```css
.card-list {
  display: grid;
  /* Automatically responsive — no media queries needed */
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

## Responsive Images

```html
<!-- srcset: choose image based on DPR -->
<img src="image.jpg" srcset="image.jpg 1x, image@2x.jpg 2x" alt="Image" />

<!-- sizes + srcset: choose image based on viewport width -->
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, 33vw"
  alt="Image"
/>

<!-- picture: different images for different devices -->
<picture>
  <source media="(max-width: 576px)" srcset="mobile.jpg" />
  <source media="(max-width: 992px)" srcset="tablet.jpg" />
  <img src="desktop.jpg" alt="Image" />
</picture>
```

## Responsive Typography

```css
/* Traditional: media queries */
h1 {
  font-size: 24px;
}
@media (min-width: 768px) {
  h1 {
    font-size: 32px;
  }
}
@media (min-width: 1200px) {
  h1 {
    font-size: 48px;
  }
}

/* Modern: clamp() — responsive and fluid */
h1 {
  /* Minimum 24px, maximum 48px, linearly interpolated in between */
  font-size: clamp(24px, 4vw, 48px);
}
```

## Vue Responsive Components

```vue
<template>
  <div :class="containerClass">
    <component :is="currentLayout" />
  </div>
</template>

<script>
export default {
  data() {
    return { windowWidth: window.innerWidth };
  },
  computed: {
    isMobile() {
      return this.windowWidth < 768;
    },
    currentLayout() {
      return this.isMobile ? "MobileLayout" : "DesktopLayout";
    },
  },
  mounted() {
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    handleResize() {
      this.windowWidth = window.innerWidth;
    },
  },
};
</script>
```

## Summary

- Mobile-first: write defaults for phones and use `min-width` to enhance upward
- CSS Grid `auto-fill + minmax` handles most responsive layouts without media queries
- `clamp()` for fluid typography without breakpoints
- Responsive images: use `srcset` + `sizes` or `<picture>` to serve the right resolution
