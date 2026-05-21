---
title: "Browser Rendering Performance: Repaint and Reflow"
date: 2018-07-28 16:01:10
tags:
  - Performance Optimization
readingTime: 1
description: "I built a complex animation and found it was janky. After studying the principles of repaint and reflow, I've compiled some optimization techniques."
wordCount: 137
---

I built a complex animation and found it was janky. After studying the principles of repaint and reflow, I've compiled some optimization techniques.

## Browser Rendering Pipeline

```
Parse HTML/CSS
    ↓
DOM Tree + CSSOM Tree
    ↓
Render Tree (visible nodes only)
    ↓
Layout (Reflow) ← calculate positions and dimensions
    ↓
Paint (Repaint) ← fill pixels
    ↓
Composite ← layer merging
```

## Reflow (Layout)

Geometric property changes require recalculating layout:

```javascript
// Operations that trigger reflow
el.style.width = "100px"; // width/height
el.style.top = "20px"; // position
el.style.fontSize = "16px"; // font size affects layout
el.className = "new-class"; // may change layout
document.body.appendChild(newEl); // DOM structure change

// Reading these properties also forces a reflow (to get accurate values)
el.offsetWidth;
el.clientHeight;
el.getBoundingClientRect();
window.getComputedStyle(el);
```

## Repaint

Visual property changes that don't affect layout — only needs repainting:

```javascript
// Only triggers repaint, not reflow
el.style.color = "red";
el.style.backgroundColor = "#fff";
el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
el.style.visibility = "hidden"; // unlike display:none (which causes reflow)
```

**Reflow always triggers repaint, but repaint doesn't always trigger reflow.**

## Optimization: Batch DOM Operations

```javascript
// ❌ Each modification triggers a reflow
el.style.width = "100px";
el.style.height = "200px";
el.style.left = "50px";

// ✅ Modify class, one reflow
el.className = "new-size";

// ✅ Use cssText for batch modifications
el.style.cssText = "width: 100px; height: 200px; left: 50px;";

// ✅ Modify offline first, then insert
const fragment = document.createDocumentFragment();
items.forEach((item) => fragment.appendChild(createEl(item)));
container.appendChild(fragment); // only triggers one reflow
```

## Optimization: Avoid Forced Synchronous Layout

```javascript
// ❌ Read-write interleaving forces reflow each time
items.forEach((item) => {
  const height = item.offsetHeight; // triggers reflow to get current value
  item.style.height = height + 10 + "px"; // write
});

// ✅ Read all first, then write all
const heights = items.map((item) => item.offsetHeight); // batch read
items.forEach((item, i) => {
  item.style.height = heights[i] + 10 + "px"; // batch write
});
```

## Optimization: Composite Layers (GPU Acceleration)

The following properties trigger GPU compositing, bypassing main thread reflow/repaint:

```css
/* Recommended for animations */
transform: translate/scale/rotate
opacity

/* Will trigger composite layer */
.animated {
  will-change: transform; /* tells browser to prepare a composite layer in advance */
}
```

```javascript
// ❌ Animating with top/left (triggers reflow)
el.style.top = y + "px";
el.style.left = x + "px";

// ✅ Animating with transform (composite only, GPU accelerated)
el.style.transform = `translate(${x}px, ${y}px)`;
```

## requestAnimationFrame

Put animations inside rAF to sync with the browser's rendering rhythm:

```javascript
function animate() {
  // executes before the next frame is painted
  updatePosition();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

## Summary

- Reflow (geometry change) > Repaint (visual change) > Composite (transform/opacity)
- Batch DOM operations, avoid read-write interleaving that triggers forced synchronous layout
- Use `transform` instead of `top/left` for animations to trigger GPU compositing
- `will-change: transform` creates composite layers in advance
- Use `requestAnimationFrame` instead of `setInterval` for animations
