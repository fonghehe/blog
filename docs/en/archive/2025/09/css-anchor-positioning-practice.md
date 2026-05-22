---
title: "CSS Anchor Positioning: From Experiment to Production in 2025"
date: 2025-09-24 09:38:15
tags:
  - CSS
readingTime: 2
description: "CSS Anchor Positioning entered Chrome 125+ in 2024, and in 2025, with Firefox and Safari catching up, it finally reached practical usability (~78% global suppor"
wordCount: 174
---

CSS Anchor Positioning entered Chrome 125+ in 2024, and in 2025, with Firefox and Safari catching up, it finally reached practical usability (~78% global support). It solves the long-standing frontend reliance on JavaScript for "floating UI" positioning: Tooltips, Popovers, dropdown menus, floating panels—all achievable with anchor positioning, no need for Popper.js or Floating UI.

## Core Concepts: Anchor and Positioned Elements

```css
/* 1. Define the anchor (the referenced element) */
.trigger-button {
  anchor-name: --my-anchor; /* give the element an anchor name */
}

/* 2. Positioned element: positioned relative to the anchor */
.tooltip {
  position: absolute; /* must be absolute/fixed positioning */
  position-anchor: --my-anchor; /* bind to anchor */

  /* anchor() function: reference the anchor's edges */
  bottom: anchor(top); /* flush with the anchor's top edge */
  left: anchor(left); /* left-aligned */

  /* Horizontally centered on anchor */
  left: calc(anchor(left) + (anchor(width) / 2));
  translate: -50% 0;
}
```

## In Practice: Pure CSS Tooltip

```html
<button class="btn" popovertarget="tip">
  Hover for tooltip
  <span id="tip" popover>This is a pure CSS Tooltip—no JS needed!</span>
</button>
```

```css
.btn {
  anchor-name: --btn-anchor;
  position: relative; /* as containing block */
}

#tip {
  position: fixed; /* fixed to position relative to anchor anywhere in viewport */
  position-anchor: --btn-anchor;

  /* default: show above button, centered */
  bottom: calc(anchor(top) - 8px);
  left: anchor(center);
  translate: -50% 0;

  /* styling */
  background: #1a1a2e;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
}

/* arrow */
#tip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  border: 6px solid transparent;
  border-top-color: #1a1a2e;
}
```

## @position-try: Auto Flip (Overflow Handling)

When the anchor is near the viewport edge, the popup needs to automatically flip direction:

```css
.popover {
  position: fixed;
  position-anchor: --trigger;

  /* default: show below */
  top: anchor(bottom);
  left: anchor(left);

  /* auto-flip rules */
  position-try-fallbacks:
    --above,    /* try option 1 */
    --left,     /* try option 2 */
    --right;    /* try option 3 */
}

/* define flip options */
@position-try --above {
  top: auto;
  bottom: anchor(top); /* show above */
}

@position-try --left {
  left: auto;
  right: anchor(left); /* show to the left */
}

@position-try --right {
  left: anchor(right); /* show to the right */
}
```

## In Practice: Dropdown Select Menu (Select Alternative)

```css
/* trigger button */
.select-trigger {
  anchor-name: --select-trigger;
}

/* dropdown list */
.select-dropdown {
  position: fixed;
  position-anchor: --select-trigger;

  /* same width as trigger, positioned directly below */
  top: anchor(bottom);
  left: anchor(left);
  width: anchor-size(width); /* anchor-size(): get anchor dimensions */
  min-width: 120px;

  position-try-fallbacks: --above;
  margin-top: 4px;

  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

@position-try --above {
  top: auto;
  bottom: calc(anchor(top) - 4px);
}
```

## Comparison with Floating UI

```
                  Floating UI/Popper.js    CSS Anchor Positioning
────────────────────────────────────────────────────────────────
Implementation    JavaScript              Pure CSS
Bundle size       ~12KB gzip              0 (browser native)
Dynamic calc      Recalculates on scroll  Browser handles auto
Auto flip         Manual middleware        @position-try
SSR compat        Needs hydration work    No issues
Browser support   All                    ~78% (Sep 2025)
Complex scenarios More flexible          Limitations
```

**Recommended strategy**: New projects can use CSS Anchor Positioning for simple scenarios (Tooltips, dropdowns); complex interactions (animations, complex alignment logic) can still use Floating UI.

## Summary

CSS Anchor Positioning is another example of "the era of JavaScript doing CSS work is finally ending." In 2025 with Firefox support arriving, it has entered the "progressive enhancement" stage. For internal tools and B2B systems (which can require modern browsers), it's now fully viable to replace Popper.js/Floating UI for basic scenarios.
