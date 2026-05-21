---
title: "Webpack Tree Shaking: Principles and Practice"
date: 2018-10-06 10:55:15
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "\"Tree shaking\" comes from Rollup — the idea of shaking unused code off like dead leaves. Webpack has supported it since version 2, but it requires correct confi"
wordCount: 163
---

"Tree shaking" comes from Rollup — the idea of shaking unused code off like dead leaves. Webpack has supported it since version 2, but it requires correct configuration to actually work.

## How It Works

Tree shaking relies on the **static structure** of ES modules (imports and exports are determined at compile time and cannot change dynamically):

```javascript
// ES module: static — analyzable at compile time
import { add } from "./math"; // only `add` is used
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
} // never imported — can be removed

// CommonJS: dynamic — cannot be analyzed
const math = require("./math"); // the entire object is imported; which parts are used is unknown
const method = "add";
math[method](); // dynamic access — tree shaking can't determine which methods will be called
```

## Prerequisites

```
1. Source code uses ES modules (import/export)
2. webpack mode is "production"
3. Babel must not convert ES modules to CommonJS
4. package.json sideEffects field is configured correctly
```

## Configure Babel Not to Convert to CommonJS

```javascript
// .babelrc or babel.config.js
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false  // Critical! Do not convert to CommonJS
    }]
  ]
}
```

## The sideEffects Field

Webpack needs to know which files have side effects (e.g., CSS, polyfills) and must not be tree-shaken away:

```json
// package.json
{
  // All files have no side effects — safe to tree-shake
  "sideEffects": false,

  // Or list files that do have side effects
  "sideEffects": ["*.css", "*.scss", "./src/polyfills.js"]
}
```

## Verifying Tree Shaking Works

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
}
export function multiply(a, b) {
  return a * b;
} // not used

// main.js
import { add } from "./math";
console.log(add(1, 2));
```

After a production build, `multiply` should not be in the bundle. Verify with `webpack-bundle-analyzer`.

## Common Issues

**Issue 1: Third-party library has no ES module version**

```javascript
// lodash is CommonJS — tree shaking doesn't work
import { debounce } from "lodash"; // bundles the entire lodash!

// Fix: use lodash-es (ES module version)
import { debounce } from "lodash-es"; // ✅ only bundles debounce

// Or import by path
import debounce from "lodash/debounce"; // ✅ also works
```

**Issue 2: Side effects in classes**

```javascript
// Class methods generally can't be tree-shaken (they may have side effects)
class Utils {
  static add(a, b) {
    return a + b;
  }
  static multiply(a, b) {
    return a * b;
  } // may still be included even if unused
}

// Export as functions instead — better tree-shaking
export function add(a, b) {
  return a + b;
}
```

## Summary

- Tree shaking requires ES modules — Babel must not transform them to CommonJS
- Set `sideEffects: false` in package.json (or list files that have side effects)
- Use `webpack-bundle-analyzer` to verify the result
- Switch `lodash` to `lodash-es` for better tree shaking of utility libraries
