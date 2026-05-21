---
title: "Frontend Performance Optimization: Tree Shaking in Depth"
date: 2018-05-29 15:51:05
tags:
  - Frontend
readingTime: 2
description: "Tree Shaking is an important optimization technique in modern frontend engineering, but the actual results often fall short of expectations. The underlying reas"
wordCount: 235
---

Tree Shaking is an important optimization technique in modern frontend engineering, but the actual results often fall short of expectations. The underlying reasons are worth understanding.

## What Is Tree Shaking

Tree Shaking leverages the static nature of ES Modules to remove unused code (dead code elimination) at bundle time:

```javascript
// utils.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
} // never used

// main.js
import { add } from "./utils";
console.log(add(1, 2));
// subtract was never imported — Tree Shaking removes it from the bundle
```

**Prerequisite**: must use ES Modules (`import/export`). CommonJS (`require`) cannot be tree-shaken.

## Why Tree Shaking Sometimes Doesn't Work

### Reason 1: Using CommonJS Modules

```javascript
// ❌ CommonJS — cannot tree-shake
const { add } = require("./utils");

// ✅ ES Module
import { add } from "./utils";
```

Before Babel 7, `@babel/preset-env` converted ES Modules to CommonJS by default, which disabled Tree Shaking.

**Fix:**

```javascript
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false, // Don't transform ES Modules — let webpack handle them
      },
    ],
  ],
};
```

### Reason 2: Side Effects

If a module has side effects (it modifies global state when executed), Tree Shaking conservatively keeps it:

```javascript
// A module with side effects: modifies global state on execution
window.myLib = { version: '1.0' }
export function doSomething() { ... }
```

Declare which files have side effects in `package.json`:

```json
{
  "sideEffects": [
    "*.css", // CSS files have side effects (global styles)
    "src/polyfills.js"
  ]
}
```

Or declare no side effects at all:

```json
{
  "sideEffects": false
}
```

### Reason 3: Wrong Import Style

```javascript
// ❌ Import the whole package
import _ from "lodash";
_.chunk([1, 2, 3, 4], 2); // entire lodash is bundled

// ✅ Import the specific function
import chunk from "lodash/chunk";

// ✅ Use lodash-es (ES Module build)
import { chunk } from "lodash-es";
```

### Reason 4: Namespace Import + Destructuring

```javascript
// ❌ Looks like a selective import, but actually imports the whole module
import * as utils from "./utils";
const { add } = utils;

// ✅ Direct named import
import { add } from "./utils";
```

## Verifying Tree Shaking

```javascript
// After building, check whether the bundle contains the removed function name
// If Tree Shaking worked, dead function names should not appear
grep -r "subtract" dist/
```

Or use `webpack-bundle-analyzer` for a visual overview.

## Tree Shaking Support in Third-Party Libraries

Only libraries that ship ES Modules support Tree Shaking:

| Library      | Tree Shaking                 |
| ------------ | ---------------------------- |
| `lodash`     | ❌ CommonJS                  |
| `lodash-es`  | ✅ ES Module                 |
| `vue`        | ✅ (2.6+)                    |
| `element-ui` | Needs babel-plugin-component |
| `date-fns`   | ✅ ES Module                 |
| `moment`     | ❌ Switch to day.js          |

## Element UI Tree Shaking

```javascript
// Method 1: babel-plugin-component (automatic on-demand import)
// babel.config.js
{
  plugins: [
    [
      "component",
      { libraryName: "element-ui", styleLibraryName: "theme-chalk" },
    ],
  ];
}

// Method 2: manual on-demand import
import { Button, Input } from "element-ui";
```

## Summary

- Tree Shaking requires ES Modules — do not use CommonJS
- Configure `modules: false` in Babel to prevent ES Module conversion
- Declare `sideEffects` in `package.json` to help the bundler make smarter decisions
- For large libraries like lodash, use the ES Module version (`lodash-es`) or import individual functions
