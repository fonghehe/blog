---
title: "CSS clip-path: Creating Irregular Shapes"
date: 2019-07-18 11:17:09
tags:
  - CSS
readingTime: 2
description: "Traditional CSS clipping is limited — `overflow: hidden` only does rectangular clipping, and `border-radius` only rounds corners. If you need diagonal-edge card"
wordCount: 179
---

Traditional CSS clipping is limited — `overflow: hidden` only does rectangular clipping, and `border-radius` only rounds corners. If you need diagonal-edge cards, circular avatar cropping, wave backgrounds, or other irregular shapes, `clip-path` is the most powerful solution available today.

## clip-path Basics

`clip-path` lets you define a clipping region, showing only content within that region. It supports five basic shape functions:

### inset() — Rectangular Clipping

```css
.clip-inset {
  clip-path: inset(10% 20% 30% 40%);
  /* Clips each side by the specified amount, similar to margin syntax */
}

/* In practice: clips around the image, keeping only the center area */
.avatar {
  clip-path: inset(5% round 50%);
  /* round followed by corner radius value */
}
```

### circle() — Circular Clipping

```css
.avatar-circle {
  width: 100px;
  height: 100px;
  clip-path: circle(50% at 50% 50%);
  /* Circle centered at 50% 50%, radius 50% */
}

/* Shorthand: omit "at", defaults to center */
.avatar-circle {
  clip-path: circle(50%);
}
```

### ellipse() — Elliptical Clipping

```css
.ellipse-shape {
  clip-path: ellipse(60% 40% at 50% 50%);
  /* Horizontal radius 60%, vertical radius 40%, centered at 50% 50% */
}
```

### polygon() — Polygon Clipping (Most Powerful)

```css
/* Triangle */
.triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  /* Three vertices: top center, bottom left, bottom right */
}

/* Trapezoid */
.trapezoid {
  clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);
}

/* Hexagon */
.hexagon {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

/* Arrow shape */
.arrow {
  clip-path: polygon(
    0% 20%,
    60% 20%,
    60% 0%,
    100% 50%,
    60% 100%,
    60% 80%,
    0% 80%
  );
}
```

### url() — Referencing SVG

```css
.clip-svg {
  clip-path: url(#myClipPath);
}
```

```html
<svg width="0" height="0">
  <defs>
    <clipPath id="myClipPath">
      <path d="M50,0 L100,100 L0,100 Z" />
    </clipPath>
  </defs>
</svg>
```

## Practice 1: Diagonal-Edge Cards

Common diagonal-edge tabs or cards in admin dashboards:

```html
<div class="tab-container">
  <div class="tab active">Overview</div>
  <div class="tab">Settings</div>
  <div class="tab">Logs</div>
</div>
```

```css
.tab-container {
  display: flex;
  gap: 2px;
}

.tab {
  padding: 12px 40px;
  background: #e0e0e0;
  color: #666;
  cursor: pointer;
  position: relative;

  /* Diagonal edges on both sides */
  clip-path: polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%);
  transition:
    background 0.2s,
    color 0.2s;
}

.tab.active {
  background: #1890ff;
  color: #fff;
}

.tab:hover:not(.active) {
  background: #d0d0d0;
}
```

## Practice 2: Wave Background

Wave dividers are common on event pages. The traditional approach uses SVG backgrounds or pseudo-elements with `border-radius`. Using `clip-path` is more flexible:

```html
<div class="hero-section">
  <div class="wave-background"></div>
  <div class="content">
    <h1>Event Title</h1>
    <p>Event description</p>
  </div>
</div>
```

```css
.hero-section {
  position: relative;
  height: 500px;
  overflow: hidden;
}

.wave-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  /* Wave-shaped clipping */
  clip-path: polygon(
    0% 0%,
    100% 0%,
    100% 75%,
    80% 80%,
    60% 85%,
    40% 82%,
    20% 88%,
    0% 83%
  );
}

.content {
  position: relative;
  z-index: 1;
  color: #fff;
  text-align: center;
  padding-top: 150px;
}
```

## Practice 3: Product Card Clipping

Irregular cards commonly seen in e-commerce product displays:

```html
<div class="product-grid">
  <div class="product-card">
    <div class="product-image">
      <img src="product1.jpg" alt="Product 1" />
    </div>
    <div class="product-info">
      <h3>Product Name</h3>
      <p class="price">$99.00</p>
    </div>
  </div>
</div>
```

```css
.product-card {
  clip-path: polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%);
  overflow: hidden;
  background: #fff;
  border-radius: 4px;
}
```

## Animation with clip-path

`clip-path` supports CSS transitions and animations:

```css
.hover-reveal {
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.5s ease;
}

.hover-reveal:hover {
  clip-path: inset(0 0% 0 0);
}
```

## Summary

- `clip-path` supports `inset()`, `circle()`, `ellipse()`, `polygon()`, and `url()` shapes
- `polygon()` is the most powerful and can create almost any shape
- Supports CSS transitions for smooth animations
- Use the [Clippy](https://bennettfeely.com/clippy/) online tool to help generate clip-path values
