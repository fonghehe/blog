---
title: "Frontend Module Evolution: From CommonJS to ES Module"
date: 2018-01-23 15:20:10
tags:
  - Engineering
readingTime: 2
description: "In 2018 we have multiple module systems coexisting: CommonJS, AMD, and ES Module. Understanding their differences helps you understand why tools like webpack an"
---

In 2018 we have multiple module systems coexisting: CommonJS, AMD, and ES Module. Understanding their differences helps you understand why tools like webpack and Babel exist.

## The Pre-Module Era

Early JavaScript had no module system. All scripts shared the global scope:

```html
<script src="jquery.js"></script>
<script src="plugin.js"></script>
<!-- depends on jQuery in global scope -->
<script src="app.js"></script>
```

Problems: naming collisions, dependency order must be manually managed, no way to know what a file depends on.

## CommonJS (Node.js)

```javascript
// math.js — export
exports.add = function (a, b) {
  return a + b;
};

// or
module.exports = { add, subtract };

// app.js — import
const { add } = require("./math");
const path = require("path"); // Node.js built-in
```

CommonJS uses **synchronous** loading, which works fine in Node.js (reading from disk). In browsers, synchronous network requests would block the page — not acceptable.

## AMD (Browser)

```javascript
// AMD: Asynchronous Module Definition
define(["jquery", "lodash"], function ($, _) {
  return {
    render: function (data) {
      return _.template("<div>...</div>")(data);
    },
  };
});
```

AMD solved the browser async loading problem, but the `define` syntax is verbose and the dependency array is disconnected from where dependencies are used.

## ES Module (ES6 Standard)

```javascript
// Named exports
export function add(a, b) { return a + b; }
export const PI = 3.14159;

// Default export
export default class Calculator { ... }

// Import
import { add, PI } from './math.js';
import Calculator from './calculator.js';
import * as math from './math.js';
```

ES Module is the modern standard. Key advantages:

1. **Static analysis** — imports resolved at parse time, enabling Tree Shaking
2. **Live bindings** — imported values reflect updates to the original
3. **Strict mode** by default
4. Native browser support (`<script type="module">`)

## Live Bindings vs Value Copy

This is a critical difference between ES Module and CommonJS:

```javascript
// counter.js
export let count = 0;
export function increment() {
  count++;
}

// main.js (ES Module)
import { count, increment } from "./counter.js";
increment();
console.log(count); // 1 — live binding, sees the updated value

// main.js (CommonJS)
const { count, increment } = require("./counter.js");
increment();
console.log(count); // 0 — value copy, doesn't see updates
```

## Tree Shaking

Tree Shaking is possible precisely because of ES Module's static analysis:

```javascript
// utils.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
} // never imported

// main.js
import { add } from "./utils.js";

// After bundling: subtract is eliminated from the bundle
```

## The module/nomodule Pattern

```html
<!-- Modern browsers: native ES Module support -->
<script type="module" src="app.modern.js"></script>

<!-- Legacy browsers: bundled version -->
<script nomodule src="app.legacy.js"></script>
```

Modern browsers download `app.modern.js` and ignore `nomodule`. Old browsers ignore `type="module"` and download `app.legacy.js`. Serve a smaller, more modern bundle to modern browsers.
