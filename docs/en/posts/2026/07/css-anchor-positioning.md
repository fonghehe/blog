---
title: "CSS Anchor Positioning in Practice: A New Paradigm for Declarative Positioning"
date: 2026-07-08 14:50:02
tags:
  - CSS
readingTime: 6
description: "The CSS Anchor Positioning API brings floating element positioning back from JavaScript to CSS. This article covers anchor-name, position-anchor, position-try, and other core properties, demonstrating declarative positioning through pure CSS implementations of Tooltips, Popovers, and Dropdowns."
wordCount: 2000
---

In frontend development, positioning floating elements has always been a headache. Tooltips, Popovers, and Dropdowns share a simple core requirement — "display next to a specific element" — but implementing them requires handling boundary detection, flipping, offsets, scroll-following, and a whole set of logic. The existence of libraries like Floating UI and Popper.js is itself proof of this complexity. The CSS Anchor Positioning API brings all of this back to CSS's declarative paradigm.

## Core Concepts and Browser Support

The core idea of Anchor Positioning is that an element can declare "I want to anchor to another element," then describe its position relative to the anchor through CSS properties. The browser handles boundary detection and flipping.

As of July 2026, Anchor Positioning browser support:

| Browser | Version | Support Status |
|--------|------|----------|
| Chrome | 125+ | Full support |
| Edge | 125+ | Full support |
| Safari | 26+ | Full support |
| Firefox | 138+ | Full support |
| Safari iOS | 26+ | Full support |

Chrome 125 first supported it in May 2024, and by 2026 all mainstream browsers have caught up. This means Anchor Positioning is now a viable option in production environments, though fallbacks are still needed.

## anchor-name and position-anchor

Two core properties form the foundation of Anchor Positioning:

```css
/* Anchor element: declares its anchor name */
.anchor-button {
  anchor-name: --tooltip-anchor;
}

/* Floating element: declares what it anchors to */
.tooltip {
  position: fixed;
  position-anchor: --tooltip-anchor;
  /* Position relative to the anchor */
  top: anchor(bottom);
  left: anchor(center);
  /* Horizontally center-align with the anchor */
  translate: -50% 0;
}
```

`anchor-name` defines a custom identifier on the anchor element (must start with `--`). `position-anchor` references this identifier on the floating element to establish the anchoring relationship.

The `anchor()` function is the core of positioning. It accepts a direction parameter:

- `anchor(top)` — top edge of the anchor element
- `anchor(bottom)` — bottom edge of the anchor element
- `anchor(left)` — left edge of the anchor element
- `anchor(right)` — right edge of the anchor element
- `anchor(center)` — horizontal center of the anchor element
- `anchor(center, 50%)` — vertical center (second parameter specifies percentage)

## Complete Tooltip Implementation

Combining with the `popover` API to implement a pure CSS Tooltip:

```html
<style>
  .tooltip-trigger {
    anchor-name: --trigger-anchor;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
  }

  .tooltip {
    popover: auto;
    position: fixed;
    position-anchor: --trigger-anchor;
    /* Position above the anchor */
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    /* Spacing */
    margin-bottom: 8px;

    background: #1f2937;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    white-space: nowrap;

    /* Entrance animation */
    transition: opacity 0.2s, transform 0.2s;
    transform-origin: bottom center;
  }

  .tooltip:popover-open {
    opacity: 1;
  }

  .tooltip::backdrop {
    background: transparent;
  }
</style>

<button class="tooltip-trigger" popovertarget="my-tooltip">
  Hover for tooltip
</button>

<div class="tooltip" id="my-tooltip" role="tooltip">
  This is a pure CSS Tooltip
</div>
```

Not a single line of JavaScript. The `popover` API handles show/hide, `position-anchor` handles positioning.

## position-try Fallback Strategy

Tooltips get clipped at viewport edges. `position-try` lets the browser automatically try alternative positions:

```css
.tooltip {
  position: fixed;
  position-anchor: --trigger-anchor;

  /* Default position: top */
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;

  /* Fallback: if not enough space above, try other positions in order */
  position-try: flip-block flip-inline;
}

/* You can also explicitly define a fallback list */
.tooltip-explicit {
  position: fixed;
  position-anchor: --trigger-anchor;
  bottom: anchor(top);
  left: anchor(center);

  /* Explicitly list all alternative positions */
  position-try-options: --top, --bottom, --left, --right;
}

@position-try --top {
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;
}

@position-try --bottom {
  top: anchor(bottom);
  left: anchor(center);
  transform: translateX(-50%);
  margin-top: 8px;
}

@position-try --left {
  right: anchor(left);
  top: anchor(center);
  transform: translateY(-50%);
  margin-right: 8px;
}

@position-try --right {
  left: anchor(right);
  top: anchor(center);
  transform: translateY(-50%);
  margin-left: 8px;
}
```

The behavior of `position-try: flip-block`: when the default position doesn't have enough space, the browser automatically flips — top becomes bottom, bottom becomes top. `flip-inline` flips left/right. Combining `flip-block flip-inline` covers all four directions.

The `@position-try` rule provides fully customizable capability. The browser tries each position listed in `position-try-options` in order until it finds one that fits completely.

### position-try-fallbacks Priority Control

```css
.dropdown {
  position: fixed;
  position-anchor: --dropdown-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  /* Strategy 1: try flipping first, then shifting */
  position-try: flip-block;

  /* Strategy 2: allow overflow without changing size */
  position-try: flip-block allow-overflow;

  /* Strategy 3: if still doesn't fit after flipping, change alignment */
  position-try: flip-block shift-inline;
}
```

`allow-overflow` allows the floating element to overflow the viewport instead of flipping, useful for scenarios where content cannot be clipped. `shift-inline` slides horizontally when there's still not enough space after flipping, instead of maintaining centered alignment.

## Dropdown Implementation and Interactive Styles

```css
.dropdown-menu {
  popover: auto;
  position: fixed;
  position-anchor: --menu-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  min-width: 200px;
  padding: 4px;

  position-try: flip-block;

  /* Entrance animation */
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}

.dropdown-menu:popover-open {
  opacity: 1;
  transform: scaleY(1);
}

.dropdown-menu:not(:popover-open) {
  opacity: 0;
  transform: scaleY(0.9);
}

.dropdown-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dropdown-item:hover {
  background: #f3f4f6;
}
```

```html
<button class="menu-trigger" popovertarget="menu" style="anchor-name: --menu-trigger">
  Menu
  <svg width="12" height="12"><!-- arrow icon --></svg>
</button>

<div class="dropdown-menu" id="menu" role="menu">
  <div class="dropdown-item" role="menuitem">Edit</div>
  <div class="dropdown-item" role="menuitem">Copy</div>
  <div class="dropdown-item" role="menuitem">Delete</div>
</div>
```

## Comparison with JavaScript Positioning Solutions

Using Floating UI as an example, the code required for equivalent functionality:

```typescript
// Floating UI implementation
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom'

const trigger = document.querySelector('.trigger')
const tooltip = document.querySelector('.tooltip')

function update() {
  computePosition(trigger, tooltip, {
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(tooltip.style, {
      left: `${x}px`,
      top: `${y}px`,
    })
  })
}

autoUpdate(trigger, tooltip, update)

// Also need to manually handle show/hide
trigger.addEventListener('mouseenter', () => {
  tooltip.style.display = 'block'
  update()
})
trigger.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none'
})
```

| Dimension | CSS Anchor Positioning | Floating UI / Popper.js |
|------|----------------------|------------------------|
| Code volume | ~20 lines CSS | ~30 lines JS + dependency |
| Runtime performance | Native browser, zero overhead | ResizeObserver + scroll listeners |
| Bundle size | 0 KB | 3-15 KB (gzip) |
| SSR friendly | Yes (pure CSS) | No (requires client hydration) |
| Flexibility | Limited fallback strategies | Fully programmable middleware |
| Browser compatibility | All mainstream in 2026 | Fully compatible (IE11+) |
| Dynamic content | Auto-follows | Requires manual update calls |

Anchor Positioning can almost entirely replace JS solutions in simple scenarios. But for complex logic (like sticky positioning, tooltips in virtualized lists, cross-iframe positioning), Floating UI remains more suitable.

## Accessibility (a11y) Considerations

The Popover API's `popover` attribute includes some built-in accessibility features:

- `popover="auto"` automatically handles focus trap
- Press Escape to auto-close
- Click outside to auto-close
- `aria-expanded` needs manual management

```html
<button
  class="tooltip-trigger"
  popovertarget="my-tooltip"
  aria-describedby="my-tooltip"
  style="anchor-name: --trigger-anchor"
>
  Action Button
</button>

<div
  class="tooltip"
  id="my-tooltip"
  role="tooltip"
  popover="auto"
>
  Click this button to perform an action
</div>
```

`role="tooltip"` with `aria-describedby` ensures screen readers can correctly associate tooltip information. For Dropdown-type components, keyboard navigation needs manual implementation:

```javascript
// Minimal keyboard navigation supplement
const menu = document.querySelector('#menu')
const trigger = document.querySelector('[popovertarget="menu"]')

trigger.addEventListener('click', () => {
  if (menu.matches(':popover-open')) {
    const firstItem = menu.querySelector('[role="menuitem"]')
    firstItem?.focus()
  }
})

menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('[role="menuitem"]')]
  const currentIndex = items.indexOf(document.activeElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[(currentIndex + 1) % items.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[(currentIndex - 1 + items.length) % items.length]?.focus()
  } else if (e.key === 'Escape') {
    trigger.focus()
  }
})
```

## Browser Compatibility Handling

Use `@supports` to detect and provide fallbacks:

```css
/* Fallback: use absolute positioning when Anchor Positioning is not supported */
.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

@supports (anchor-name: --x) {
  .tooltip {
    position: fixed;
    position-anchor: --trigger-anchor;
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    margin-top: 0;
    margin-bottom: 8px;
  }
}
```

For projects requiring complete fallbacks, `@floating-ui/dom` can be used as a polyfill:

```javascript
// Detect Anchor Positioning support
const supportsAnchor = CSS.supports('anchor-name: --x')

if (!supportsAnchor) {
  // Degrade to Floating UI
  const { autoUpdate, computePosition, offset, flip, shift } = await import(
    '@floating-ui/dom'
  )
  // Initialize all .tooltip elements
}
```

Progressive enhancement strategy: modern browsers get the native experience, older browsers use JS fallback, with the two approaches switching via `@supports`.

## Pros and Cons Analysis

**Pros:**

- Zero JavaScript runtime overhead; positioning calculations are done natively by the browser
- Deep integration with the Popover API — show/hide/positioning in one
- Declarative syntax is more maintainable than imperative JS
- Automatically handles scroll, resize, and other edge cases
- SSR friendly, no dependency on client JS

**Cons:**

- Fallback strategies are less flexible than Floating UI, limited in complex scenarios
- Dynamic anchors (like tooltips for list items) require dynamic `anchor-name` setup, still needs some JS
- Animation control is limited to CSS transitions; physics-based spring animations are not possible
- Cross-container positioning (like tooltips inside modals) has stacking context issues
- Debugging tools are incomplete; Chrome DevTools visualization of anchor relationships needs improvement

## Future Outlook

CSS Anchor Positioning Level 2 is discussing the following extensions:

- `anchor-scroll` — support for anchor positioning within scroll containers
- `anchor-pos` — finer-grained position control, supporting percentages and calculations
- Integration with View Transitions API — smooth transitions during position changes
- `anchor-match` — conditional styling based on anchor state

These extensions will further narrow the capability gap with JS solutions.

## Personal Opinion

Anchor Positioning is another milestone in CSS returning to its declarative roots. From Flexbox to Grid to Container Queries and now Anchor Positioning, CSS is gradually reclaiming territory held by JavaScript. For the vast majority of Tooltip and Dropdown scenarios, the pure CSS solution is sufficient — and offers better performance with less code.

But I don't recommend completely abandoning Floating UI in production. For two reasons: first, the compatibility transition period requires a polyfill; second, complex scenarios (like floating menus inside rich text editors) still need the precise control that JS provides. The pragmatic approach: use CSS for simple scenarios, JS for complex ones, and let them coexist through `@supports`.

## Summary

CSS Anchor Positioning achieves declarative positioning through `anchor-name`, `position-anchor`, and the `anchor()` function, with `position-try` handling boundary flipping. Combined with the Popover API, you can implement complete Tooltip and Dropdown components in pure CSS. Compared to Floating UI, it has zero runtime overhead and is SSR-friendly, but with limited flexibility. In the 2026 browser landscape, Anchor Positioning is production-ready — adopt a progressive enhancement strategy: native first, JS fallback as backup.
