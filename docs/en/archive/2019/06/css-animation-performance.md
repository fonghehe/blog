---
title: "CSS Animation Performance: will-change  & CompositeLayerAdvanced"
date: 2019-06-06 16:37:34
tags:
  - CSS
readingTime: 1
description: "After working with frontend animations for a while, you realize the challenge isn't writing animations — it's that too many animations cause jank. Especially on"
wordCount: 187
---

After working with frontend animations for a while, you realize the real challenge isn't writing animations — it's that animating too many things at once causes jank. On mobile especially, hitting 60 fps is the baseline for a smooth user experience. This article starts with the browser's rendering pipeline to show where CSS animations slow down and how to optimize them.

## The Browser Rendering Pipeline

To optimize animation performance, you first need to understand how a browser renders a frame:

```
JavaScript → Style → Layout → Paint → Composite
```

What each stage does:

- **Style**: calculate the final CSS styles for elements
- **Layout** (reflow): calculate the geometry of elements — position, width, height
- **Paint** (repaint): fill in pixels — colors, borders, shadows, text
- **Composite**: merge multiple layers into the final page

Key insight: **the further down the pipeline a property change is handled, the cheaper it is**. Properties handled at the Composite stage don't trigger Layout or Paint.

## Which CSS Properties Trigger Which Stages

```css
/* Composite only (best) */
.animated-gpu {
  /*
   * transform and opacity are the two safest animation properties.
   * They can be handled directly by the GPU, no layout or repaint needed.
   */
  transform: translateX(100px);
  transform: rotate(45deg);
  transform: scale(1.5);
  opacity: 0.5;
}

/* Paint + Composite (moderate cost) */
.animated-paint {
  /*
   * These properties don't change geometry (no reflow needed),
   * but require re-painting pixels.
   */
  color: red;
  background: blue;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Layout + Paint + Composite (most expensive — avoid in animations) */
.animated-layout {
  /*
   * These change element geometry, causing the browser to
   * recalculate layout (reflow), then repaint and composite.
   */
  width: 200px;
  height: 100px;
  margin: 10px;
  padding: 20px;
  top: 50px;
  left: 50px;
  font-size: 16px;
}
```

Core principle in one sentence: **use only `transform` and `opacity` for animations**.

## GPU Acceleration

```css
/* Promote to its own compositor layer */
.will-animate {
  will-change: transform, opacity;
  /* or the legacy hack: transform: translateZ(0); */
}
```

## Practical Example: Slide-in Card

```css
/* ❌ Using top/left to animate (triggers Layout) */
.card-bad {
  position: absolute;
  top: -100px;
  transition: top 0.3s ease;
}
.card-bad.active {
  top: 0;
}

/* ✅ Using transform to animate (Composite only) */
.card-good {
  transform: translateY(-100px);
  transition: transform 0.3s ease;
}
.card-good.active {
  transform: translateY(0);
}
```

Always profile with the DevTools Performance panel first — measure the actual bottleneck before optimizing.
