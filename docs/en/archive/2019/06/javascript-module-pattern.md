---
title: "The Evolution of JavaScript Modules: From IIFE to ES Modules"
date: 2019-06-10 10:39:59
tags:
  - JavaScript
readingTime: 1
description: "JavaScript had no native module system for a long time. The community explored many solutions across its history. Understanding this evolution helps you know wh"
---

JavaScript had no native module system for a long time. The community explored many solutions across its history. Understanding this evolution helps you know why modern toolchains are built the way they are.

## Stage 1: Global Variables (Messy)

```javascript
// utils.js — pollutes the global scope
var utils = {
  formatDate: function (date) {
    /* ... */
  },
};

// app.js — relies on globals
utils.formatDate(new Date());

// Problems: naming conflicts, unclear dependency order,
// hard to determine which script to load first
```

## Stage 2: IIFE (Immediately Invoked Function Expression)

```javascript
// Encapsulate private variables with a closure
var MyModule = (function () {
  // Private variables
  var privateData = "internal data";

  // Private function
  function privateMethod() {
    return privateData;
  }

  // Public API
  return {
    getData: function () {
      return privateMethod();
    },
    setData: function (value) {
      privateData = value;
    },
  };
})();

MyModule.getData(); // works
MyModule.privateData; // undefined — encapsulated
```

## Stage 3: CommonJS (Node.js)

```javascript
// math.js
function add(a, b) {
  return a + b;
}
module.exports = { add };

// app.js
const { add } = require("./math");
console.log(add(1, 2)); // 3

// Problem: synchronous loading — not suitable for browsers
// (network requests are inherently async)
```

## Stage 4: AMD (Browser Async)

```javascript
// RequireJS: async loading via define/require
define(["jquery", "underscore"], function ($, _) {
  function MyView() {
    this.$el = $("<div>");
  }
  return MyView;
});

// Problem: verbose syntax; not the final answer
```

## Stage 5: UMD (Universal)

```javascript
// Compatible with CommonJS + AMD + global variable
(function (global, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(); // CommonJS
  } else if (typeof define === "function" && define.amd) {
    define(factory); // AMD
  } else {
    global.MyLib = factory(); // global
  }
})(this, function () {
  return { version: "1.0.0" };
});
```

## Stage 6: ES Modules (Native Standard)

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export const PI = 3.14159;
export default class Calculator {
  /* ... */
}

// app.js
import Calculator, { add, PI } from "./math.js";
import * as MathUtils from "./math.js";

// Native browser support
// <script type="module" src="app.js"></script>
```

Key advantages of ES Modules:

- **Static analysis**: imports/exports are determined at parse time, enabling tree-shaking
- **Live bindings**: imported values reflect the live binding, not a copy
- **Native support**: modern browsers and Node.js 12+ support it natively

In 2019, the practical setup is: write ESM source code, use Webpack/Rollup/Babel to compile to a compatible format for older environments.
