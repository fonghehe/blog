---
title: "CSS position and Stacking Context"
date: 2018-07-05 10:44:49
tags:
  - CSS
readingTime: 1
description: "`position` is a property every frontend developer must know, but `z-index` not working as expected has tripped up many people."
---

`position` is a property every frontend developer must know, but `z-index` not working as expected has tripped up many people.

## Five Positioning Modes

```css
/* static: default, doesn't participate in z-index stacking */
position: static;

/* relative: offset from original position, stays in document flow */
position: relative;
top: 10px; /* moves down 10px, original space is still occupied */

/* absolute: positioned relative to nearest non-static ancestor, removed from flow */
position: absolute;
top: 0;
right: 0; /* top-right corner */

/* fixed: positioned relative to viewport, removed from flow, doesn't scroll */
position: fixed;
bottom: 20px;
right: 20px; /* fixed in bottom-right corner */

/* sticky: acts as relative until threshold, then becomes fixed */
position: sticky;
top: 60px; /* fixes when scrolled to 60px from top of viewport */
```

## Reference Point for absolute Positioning

Finds the nearest **non-static** ancestor:

```html
<div class="parent" style="position: relative;">
  <!-- reference is this element -->
  <div class="child" style="position: absolute; top: 10px; left: 10px;"></div>
</div>
```

If no non-static ancestor exists, it positions relative to `<html>`.

## Stacking Context

`z-index` not working is almost always caused by not understanding stacking contexts.

Common ways to create a stacking context:

- `position: relative/absolute/fixed` + `z-index` not auto
- `opacity < 1`
- `transform: translate/rotate/scale` etc.
- `filter` is not none
- `will-change`

```html
<div style="position: relative; z-index: 1;">
  <!-- This has its own stacking context -->
  <div style="position: absolute; z-index: 999;">
    <!-- z-index: 999 only applies within the parent context -->
    <!-- Cannot surpass a sibling's z-index: 2 -->
  </div>
</div>
<div style="position: relative; z-index: 2;">
  <!-- This renders above the z-index: 999 element -->
</div>
```

**Key understanding**: a child element's `z-index` is only compared within its parent stacking context and cannot escape it.

## Common Trap: transform Creates a Stacking Context

```css
/* A parent with transform breaks fixed positioning for children! */
.parent {
  transform: translateZ(0); /* or will-change: transform */
}
.child {
  position: fixed; /* now positioned relative to .parent, not the viewport */
}
```

## Practical Tips

```css
/* Vertical and horizontal centering (classic absolute approach) */
.centered {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Fixed bottom navigation (handling Safari safe area) */
.bottom-nav {
  position: fixed;
  bottom: 0;
  bottom: env(safe-area-inset-bottom); /* iOS notch */
  width: 100%;
}

/* Sticky table header */
thead th {
  position: sticky;
  top: 0;
  background: white; /* must have a background, otherwise it's transparent */
  z-index: 1;
}
```

## Summary

- `absolute` finds the nearest non-static ancestor
- Stacking contexts isolate internal `z-index` — this is the root cause of z-index not working
- `transform`, `opacity < 1`, and `filter` all create stacking contexts
- `sticky` requires the parent to have a defined height and must not have `overflow: hidden`
