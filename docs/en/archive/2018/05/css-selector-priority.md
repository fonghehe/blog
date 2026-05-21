---
title: "CSS Selector Specificity"
date: 2018-05-06 14:48:34
tags:
  - CSS
readingTime: 1
description: "When CSS styles don't apply, specificity is almost always the reason. This article explains the specificity rules clearly."
wordCount: 131
---

When CSS styles don't apply, specificity is almost always the reason. This article explains the specificity rules clearly.

## Specificity Weights

| Selector type                | Weight                         | Example                              |
| ---------------------------- | ------------------------------ | ------------------------------------ |
| !important                   | Highest (overrides everything) | `color: red !important`              |
| Inline style                 | 1000                           | `style="color: red"`                 |
| ID selector                  | 100                            | `#header`                            |
| Class/attribute/pseudo-class | 10                             | `.active`, `[type="text"]`, `:hover` |
| Element/pseudo-element       | 1                              | `div`, `p`, `::before`               |
| Universal selector           | 0                              | `*`                                  |

## How to Calculate

Specificity is counted in three separate columns (not summed into a single decimal number):

```
Format: (inline, ID, class/attribute/pseudo-class, element)

a { color: red }                    → (0, 0, 0, 1)
.nav a { color: red }               → (0, 0, 1, 1)
#header .nav a { color: red }       → (0, 1, 1, 1)
```

Comparison starts from the highest column; the higher value wins:

```css
/* Which one wins? */
#header a {
  color: blue;
} /* (0, 1, 0, 1) */
.nav .link a {
  color: red;
} /* (0, 0, 2, 1) */

/* Result: #header a wins — ID column 1 > 0 */
```

## Same Specificity: Last Rule Wins

```css
.btn {
  color: red;
}
.btn {
  color: blue;
} /* The later rule wins — button is blue */
```

## Real-World Scenarios

```css
/* Scenario: overriding component library styles */

/* Element UI button */
.el-button {
  color: #409eff;
}

/* Your override */
.el-button {
  color: red;
} /* Doesn't work — the library CSS may be loaded after yours */

/* Force override (not ideal, but sometimes necessary) */
.el-button {
  color: red !important;
}

/* Better approach: increase specificity */
.my-page .el-button {
  color: red;
} /* Add a parent selector to raise the weight */
```

## Rules for Using !important

```css
/* ❌ The !important arms race */
.btn {
  color: red !important;
}
.special-btn {
  color: blue !important;
}
/* Both use !important — falls back to last-rule-wins anyway */

/* ✅ Legitimate use of !important */
/* Utility classes: explicitly designed to force override */
.text-center {
  text-align: center !important;
}
.hidden {
  display: none !important;
}
```

## Common Misconceptions

```css
/* Misconception: more nesting levels = higher weight */
div div div div {
  color: red;
} /* (0, 0, 0, 4) */
.active {
  color: blue;
} /* (0, 0, 1, 0) */

/* Result: .active wins — class selector beats element selectors */

/* Misconception: pseudo-element ::before vs pseudo-class :hover */
a::before {
} /* weight 1 (pseudo-element) */
a:hover {
} /* weight 10 (pseudo-class) */
```

## Development Tips

```
1. Avoid !important — it makes maintenance harder
2. Use BEM naming to reduce nesting depth and avoid specificity conflicts
3. When styles don't apply, use DevTools to see which rule is overriding
4. For overriding component library styles, add a parent selector instead of !important
```

## Summary

- Weight from high to low: !important > inline > ID (100) > class/attribute/pseudo-class (10) > element (1)
- Equal specificity: the later rule wins
- Specificity comparison is column-by-column, not a simple sum
- Avoid `!important` when possible — increase specificity instead
