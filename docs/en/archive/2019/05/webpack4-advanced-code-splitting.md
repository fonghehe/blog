---
title: "Deep Dive: How Webpack 4 Tree Shaking Works"
date: 2019-05-22 10:35:50
tags:
  - Webpack
  - Engineering
readingTime: 1
description: "Tree Shaking is an important optimization in Webpack 4 that automatically removes unused code during bundling. But many people just set `mode: 'production'` and"
wordCount: 161
---

Tree Shaking is an important optimization in Webpack 4 that automatically removes unused code during bundling. But many people just set `mode: 'production'` and think they're done — there's actually a lot of underlying principle worth understanding.

## What Is Tree Shaking

The name "Tree Shaking" comes from shaking a tree to drop its dead leaves. In Webpack's context, "dead leaves" are module exports that were never imported anywhere.

Its core prerequisite: **the static structure of ES Modules**.

```javascript
// math.js - exports add and subtract
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// app.js - only uses add
import { add } from "./math";

console.log(add(1, 2));
// subtract is never referenced → should be removed
```

After bundling, `subtract` should not appear in the final output.

## Why ESM Can Do It, But CommonJS Cannot

```javascript
// CommonJS - dynamic loading, can't determine exports at compile time
const math = require("./math");
math.add(1, 2);
// Problem: what properties does the math object have?
// Only known at runtime → static analysis impossible

// More extreme case
const modules = require("./modules");
const name = getModuleName();
modules[name](); // completely unanalyzable
```

```javascript
// ESM - static imports, dependency graph is known at compile time
import { add } from "./math";
// 1. Imported identifiers are fixed at compile time (cannot be inside an if)
// 2. Module exports are static (cannot be dynamically modified)
// 3. Module top-level execution, no conditional branches
```

## Webpack 4 Tree Shaking Workflow

Webpack 4 Tree Shaking has two phases: **marking** and **elimination**.

```javascript
// utils.js
export function used() {
  // ← marked as "used"
  return "I am used";
}

export function unused() {
  // ← marked as "unused"
  return "I am unused";
}
```

```javascript
// webpack.config.js
module.exports = {
  mode: "production", // enables Tree Shaking and Terser
  optimization: {
    usedExports: true, // mark unused exports
    minimize: true, // Terser removes the dead code
  },
};
```

## Common Reasons Tree Shaking Doesn't Work

1. **Using CommonJS**: `require()` prevents static analysis
2. **Side effects**: mark pure modules in `package.json`:
   ```json
   { "sideEffects": false }
   // or list specific files with side effects:
   { "sideEffects": ["./src/polyfills.js", "*.css"] }
   ```
3. **Babel transforms ESM to CommonJS**: make sure Babel doesn't transform `import/export`
   ```json
   { "presets": [["@babel/preset-env", { "modules": false }]] }
   ```

Tree Shaking is not magic — it requires ES Modules, production mode, and side-effect-free code to work correctly.
