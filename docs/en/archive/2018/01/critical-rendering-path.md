---
title: "Frontend Performance: Understanding the Critical Rendering Path"
date: 2018-01-11 17:34:30
tags:
  - Performance Optimization
readingTime: 2
description: "Before doing performance optimization, you need to understand what happens between the browser receiving HTML and the user seeing the page. These steps together"
---

Before doing performance optimization, you need to understand what happens between the browser receiving HTML and the user seeing the page. These steps together are called the **Critical Rendering Path**. Without understanding this, most optimization techniques are just cargo-culting.

## The Five Steps of Browser Rendering

1. **Parse HTML → build the DOM tree**
2. **Parse CSS → build the CSSOM tree**
3. **Combine DOM and CSSOM → build the Render Tree**
4. **Layout (Reflow)**: calculate position and size of each node
5. **Paint**: convert the render tree to pixels on screen

Steps 1 and 2 happen in parallel, but there's one critical blocking rule: **CSS blocks rendering; JS blocks parsing**.

## CSS Blocks Rendering

The browser must wait for the CSSOM to be fully built before it can start rendering. The reason is simple: if the browser rendered first then waited for CSS, users would see a flash of unstyled content (FOUC).

```html
<!-- This CSS file's download and parsing blocks page rendering -->
<link rel="stylesheet" href="/styles/main.css" />
```

Optimization directions:

- Reduce CSS file size, remove unused styles (PurgeCSS)
- Inline critical CSS (styles for above-the-fold content)
- Load non-critical CSS asynchronously

```html
<!-- Inline critical CSS -->
<style>
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .header {
    height: 60px;
    background: #fff;
  }
</style>

<!-- Non-critical CSS loaded asynchronously -->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.rel='stylesheet'"
/>
```

## JS Blocks HTML Parsing

When the HTML parser encounters a `<script>` tag, it **pauses DOM construction** and waits for JS to download and execute. The reason: JS may modify the DOM (`document.write`).

```html
<!-- Bad: blocks DOM parsing, long first-paint time -->
<head>
  <script src="/js/app.js"></script>
</head>

<!-- Better: put at bottom of body, executes after DOM is parsed -->
<body>
  <!-- page content -->
  <script src="/js/app.js"></script>
</body>
```

Even better: use `defer` or `async`:

```html
<!-- defer: download async, execute in order after DOM is ready -->
<script defer src="/js/vendor.js"></script>
<script defer src="/js/app.js"></script>

<!-- async: download async, execute immediately when ready (no order guarantee) -->
<script async src="/js/analytics.js"></script>
```

`defer` is suitable for most application scripts; `async` is suitable for independent third-party scripts (analytics, ads).

## Reflow and Repaint

After initial rendering, modifying DOM or styles triggers re-rendering:

- **Reflow (Layout)**: geometric properties changed, recalculate positions. Most expensive.
- **Repaint**: visual appearance changed (color, background), layout unaffected. Moderate cost.
- **Composite**: only `transform` and `opacity` affected, handled in separate compositing layer. Cheapest.

```javascript
// Properties that trigger reflow (reading them also forces synchronous layout)
element.offsetWidth;
element.offsetHeight;
element.scrollTop;
element.clientWidth;
window.getComputedStyle(element);

// Avoid mixing reads and writes in loops (forced synchronous layout)
// Bad: forces browser to recalculate layout each iteration
for (let i = 0; i < items.length; i++) {
  items[i].style.width = container.offsetWidth + "px"; // read + write
}

// Good: read once, then batch writes
const containerWidth = container.offsetWidth;
for (let i = 0; i < items.length; i++) {
  items[i].style.width = containerWidth + "px";
}
```

## Use Compositing Layers for High-Performance Animation

Promote animated elements to their own compositing layer so animations don't trigger reflow or repaint:

```css
.animated-element {
  will-change: transform; /* hint to browser to create a compositing layer */
  transform: translateZ(0); /* old way to force compositing layer */
}

/* High-performance animation: use only transform and opacity */
@keyframes slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

Don't overuse `will-change` — each compositing layer consumes GPU memory.

## Use Chrome DevTools to Find Bottlenecks

1. Open DevTools, go to the **Performance** panel
2. Click record, perform your action, stop recording
3. Look at the flame chart, focus on:
   - Purple **Layout** blocks (reflow)
   - Green **Paint** blocks (repaint)
   - "Long tasks" (tasks over 50ms)

Once you identify specific reflow/repaint triggers, targeted fixes are far more efficient than blind optimization.
