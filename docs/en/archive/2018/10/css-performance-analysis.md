---
title: "CSS Animation Performance: transform and opacity"
date: 2018-10-03 11:29:08
tags:
  - CSS
readingTime: 2
description: "I added a slide-in animation that was noticeably choppy on mobile. After investigating I found it was using `margin`/`top` for the animation. Switching to `tran"
wordCount: 159
---

I added a slide-in animation that was noticeably choppy on mobile. After investigating I found it was using `margin`/`top` for the animation. Switching to `transform` made it smooth.

## Why transform Is Faster

The browser rendering pipeline:

```
JavaScript → Style → Layout → Paint → Composite
(JS exec)  (style calc) (layout) (paint) (composite)
```

Different properties trigger different stages:

```
left/top/margin/width/height → triggers Layout (reflow) + Paint + Composite
  - Changes the element's geometry
  - Requires recalculating positions of all affected elements
  - Slowest

background/color/visibility → triggers Paint (repaint) + Composite
  - Doesn't change geometry, but pixels must be redrawn
  - Medium

transform/opacity → triggers Composite only
  - Does not affect document flow; handled by the GPU on an independent layer
  - Fastest
```

## Practical Comparison

```css
/* ❌ Slow: triggers reflow */
@keyframes slide-in-bad {
  from {
    left: -100px;
  }
  to {
    left: 0;
  }
}

/* ✅ Fast: composite only */
@keyframes slide-in-good {
  from {
    transform: translateX(-100px);
  }
  to {
    transform: translateX(0);
  }
}

/* ❌ Slow: changing size triggers reflow */
@keyframes expand-bad {
  from {
    width: 100px;
    height: 100px;
  }
  to {
    width: 200px;
    height: 200px;
  }
}

/* ✅ Fast: use scale instead */
@keyframes expand-good {
  from {
    transform: scale(0.5);
  }
  to {
    transform: scale(1);
  }
}
```

## will-change: Hint the Browser to Prepare Early

```css
/* Tell the browser this element will animate, so it creates a composite layer in advance */
.animated-element {
  will-change: transform;
}

/* Or use the translateZ(0) hack (old approach, not recommended) */
.animated-element {
  transform: translateZ(0);
}
```

**Caution**: Don't overuse `will-change` — every composite layer consumes extra memory:

```css
/* ❌ Adding it to every element (one composite layer each — memory blowup) */
* {
  will-change: transform;
}

/* ✅ Only on elements that truly need animation; remove it after the animation ends */
.card:hover {
  will-change: transform;
}
```

## Controlling will-change with JavaScript

```javascript
// Fine-grained control: add on hover, remove on leave
element.addEventListener("mouseenter", () => {
  element.style.willChange = "transform";
});
element.addEventListener("animationend", () => {
  element.style.willChange = "auto"; // Free the resource
});
```

## Debugging Tools

Chrome DevTools → Rendering panel:

- **Paint flashing**: green highlights show which areas are repainting — bigger areas = slower
- **Layer borders**: shows composite layer boundaries so you can see how many layers exist
- **FPS meter**: real-time frame rate

## Smooth Animation in Practice

```css
/* Complete smooth card hover effect */
.card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  will-change: transform;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

## Summary

- Use `transform` and `opacity` for animations — they only trigger the Composite stage
- Avoid animating `left`, `top`, `width`, `height` — they trigger costly Layout + Paint
- Use `will-change` sparingly; add it only when needed and remove it afterward
- Use the DevTools Rendering panel to verify which areas are repainting
