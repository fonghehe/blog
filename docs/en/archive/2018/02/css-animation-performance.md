---
title: "CSS Animation Performance: From Principles to Practice"
date: 2019-06-06 16:37:34
tags:
  - CSS
readingTime: 2
description: "CSS animations are common, but poorly written animations can stutter and drain battery. Understanding the browser rendering pipeline is essential before doing a"
wordCount: 291
---

CSS animations are common, but poorly written animations can stutter and drain battery. Understanding the browser rendering pipeline is essential before doing any animation optimization.

## Browser Rendering Pipeline

```
Style → Layout → Paint → Composite
```

- **Style**: calculate which CSS rules apply
- **Layout (Reflow)**: calculate geometry (position, size)
- **Paint**: fill in pixels (color, background, shadow)
- **Composite**: merge layers and display on screen

Animations that change properties in the Layout or Paint stage force the browser to redo expensive work every frame. Only `transform` and `opacity` are handled entirely in the **Composite** stage — no layout or paint needed.

## Which Properties Trigger Which Stages

| Property              | Layout | Paint | Composite |
| --------------------- | ------ | ----- | --------- |
| width, height, margin | ✅     | ✅    | ✅        |
| background, color     | ❌     | ✅    | ✅        |
| transform             | ❌     | ❌    | ✅        |
| opacity               | ❌     | ❌    | ✅        |

For any animation, use `transform` and `opacity` whenever possible.

## Replace left/top with transform

```css
/* Bad: triggers layout + paint on every frame */
@keyframes move-bad {
  from {
    left: 0;
  }
  to {
    left: 300px;
  }
}

/* Good: only triggers composite */
@keyframes move-good {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(300px);
  }
}
```

Same visual result, but `transform` version runs on the GPU in a separate compositing layer — the main thread is never blocked.

## will-change: Correct Usage

`will-change` tells the browser to promote the element to its own compositing layer before the animation starts:

```css
/* Applied to the element that will animate */
.animated-menu {
  will-change: transform;
}

/* Remove after animation completes (via JavaScript) */
element.addEventListener('animationend', () => {
  element.style.willChange = 'auto';
});
```

**Common mistakes:**

```css
/* Wrong: don't add to everything */
* {
  will-change: transform; /* creates thousands of compositing layers */
}

/* Wrong: applying too early, keeping too long */
.card {
  will-change: transform; /* applied to every card even without animation */
}
```

`will-change` should be applied just before animation and removed after. Each extra compositing layer consumes GPU memory — don't abuse it.

## Verifying Compositing Layers in DevTools

In Chrome DevTools:

1. Open **Layers** panel (Menu → More Tools → Layers)
2. Elements with their own compositing layer appear separately
3. Check the "Why this layer?" tooltip — should say "Has a will-change CSS property"

For jank diagnosis, use **Performance** panel → record → look for green Paint and purple Layout events per frame.

## Practical Example: Dropdown Menu

```css
.dropdown {
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.2s ease;
  will-change: transform;
}

.dropdown.open {
  transform: scaleY(1);
}
```

This dropdown animation uses only `transform` — no layout, no paint on every frame. The `will-change: transform` hints the browser to create a compositing layer, making the animation completely GPU-accelerated.
