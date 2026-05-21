---
title: "Mobile Adaptation: From rem to vw/vh"
date: 2018-04-05 09:43:44
tags:
  - CSS
readingTime: 3
description: "Mobile adaptation is an unavoidable topic in frontend development. From early percentage layouts to rem, and now to vw/vh — each approach has its trade-offs. He"
wordCount: 385
---

Mobile adaptation is an unavoidable topic in frontend development. From early percentage layouts to rem, and now to vw/vh — each approach has its trade-offs. Here's a breakdown of the principles and how to choose.

## Why Adaptation Is Needed

Mobile device screen widths vary widely: 320px (iPhone 5) → 414px (iPhone 8 Plus) → 768px (iPad).

Designers typically provide a 375px mockup that needs to scale proportionally across all screen sizes.

## Solution 1: viewport meta

This is the foundation of all approaches — it tells the browser how to handle the viewport:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
/>
```

- `width=device-width`: viewport width equals device width
- `initial-scale=1.0`: initial zoom level 1:1
- `user-scalable=no`: prevents user zooming (controversial: accessibility requires zoom support)

## Solution 2: rem + flexible.js

`rem` is a unit relative to the `<html>` root element's font size. flexible.js (Taobao's approach) dynamically sets the root font size:

```javascript
// flexible.js core logic (simplified)
(function () {
  const docEl = document.documentElement;

  function setRemUnit() {
    // Based on a 375px design: 1rem = device width / 10
    const rem = docEl.clientWidth / 10;
    docEl.style.fontSize = rem + "px";
  }

  setRemUnit();
  window.addEventListener("resize", setRemUnit);
})();
```

On a 375px device: `1rem = 37.5px`

An element that's `75px` in the design = `75 / 37.5 = 2rem`

### Auto-Convert with PostCSS

Manually calculating px → rem every time is tedious. Use `postcss-pxtorem` to automate it:

```bash
npm install postcss-pxtorem
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-pxtorem": {
      rootValue: 37.5, // baseline: 1rem = 37.5px (for a 375px design)
      propList: ["*"], // convert all properties
      selectorBlackList: [".norem"], // skip this class
    },
  },
};
```

```css
/* Write in px */
.button {
  width: 200px;
  height: 44px;
  font-size: 14px;
}

/* Compiled — automatically converted to rem */
.button {
  width: 5.33333rem;
  height: 1.17333rem;
  font-size: 0.37333rem;
}
```

## Solution 3: vw/vh (Modern Approach)

`vw` = 1% of the viewport width, `vh` = 1% of the viewport height.

On a 375px device: `1vw = 3.75px`

A `75px` element in the design = `75 / 3.75 = 20vw`

**Advantages:**

- No JavaScript required — pure CSS
- No script dependency, more robust

**Auto-convert with `postcss-px-to-viewport`:**

```bash
npm install postcss-px-to-viewport
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    "postcss-px-to-viewport": {
      viewportWidth: 375, // design width
      viewportHeight: 667,
      unitPrecision: 5, // precision
      viewportUnit: "vw", // target unit
      selectorBlackList: [".ignore"], // skip these
      minPixelValue: 1, // don't convert values less than 1px
      mediaQuery: false, // don't convert px in media queries
    },
  },
};
```

## Solution 4: The 1px Problem

The most frustrating mobile adaptation issue: a design's 1px border looks like 2px on Retina screens (DPR=2).

**Physical pixels vs CSS pixels:**

- iPhone's DPR = 2 means 1 CSS px = 2 physical pixels
- A 1px border looks 2 physical pixels wide on Retina screens

**Solution: pseudo-element + transform**

```scss
@mixin border-1px($color: #eee) {
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background-color: $color;
    transform-origin: 0 bottom;

    @media (-webkit-min-device-pixel-ratio: 2) {
      transform: scaleY(0.5);
    }
    @media (-webkit-min-device-pixel-ratio: 3) {
      transform: scaleY(0.333);
    }
  }
}
```

## How to Choose

| Approach               | Best For                                                      |
| ---------------------- | ------------------------------------------------------------- |
| rem + flexible         | Needing to support older Android, team is familiar with it    |
| vw/vh                  | New projects, compatibility: iOS 8+ / Android 4.4+            |
| Fixed width + centered | PC marketing pages for mobile, no proportional scaling needed |

Practical reality in 2018: rem was still the mainstream, but vw/vh was usable in new projects.

## Summary

- rem is mature with a good ecosystem, but needs JavaScript support
- vw/vh is cleaner, doesn't depend on JS, and browser support is sufficient
- Both work well with PostCSS auto-conversion — just write design-spec px values
- Use pseudo-element + transform scaleY to solve the 1px problem
