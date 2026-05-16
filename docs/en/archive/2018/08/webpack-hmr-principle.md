---
title: "Webpack HMR: How Hot Module Replacement Works"
date: 2018-08-25 09:35:16
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "When you modify code during development and the page updates automatically — that's HMR (Hot Module Replacement). We take it for granted every day, but today I "
---

When you modify code during development and the page updates automatically — that's HMR (Hot Module Replacement). We take it for granted every day, but today I dug into how it actually works.

## The HMR Flow

```
1. Webpack watches for file changes (watch mode)
2. File change → recompile the changed modules
3. Compilation done → notify the browser via WebSocket (send hash)
4. Browser receives notification → requests updated modules from dev server (manifest + chunk)
5. Browser receives new modules → HMR Runtime replaces old modules
6. If replacement succeeds → partial update, no page reload
7. If replacement fails → force reload the entire page (fallback)
```

## webpack-dev-server's Role

```javascript
// webpack-dev-server does two things:
// 1. Start an HTTP server (serve static assets)
// 2. Start a WebSocket server (push update notifications)

// The HMR client code injected in the browser (included in the bundle)
// Establishes a WebSocket connection and listens for webpack compile events
const socket = new WebSocket("ws://localhost:8080");
socket.onmessage = (e) => {
  const { type, data } = JSON.parse(e.data);
  if (type === "hash") {
    currentHash = data; // Record the latest hash
  }
  if (type === "ok") {
    // Compilation done, request updates
    checkForUpdates();
  }
};
```

## How Module Replacement Works

```javascript
// All webpack-compiled modules are registered in the __webpack_modules__ object
// HMR replaces the corresponding function in this object

// Suppose foo.js was modified:
__webpack_modules__["./src/foo.js"] = function (module, exports) {
  // New foo.js code goes here
};

// Then notify the modules that depend on foo.js to re-execute
// If a module handles hot.accept, it does a partial update
// Otherwise, it bubbles up until a handler is found, or a full page reload is triggered
```

## module.hot.accept: Partial Hot Replacement

```javascript
// Declare that this module accepts updates to itself
if (module.hot) {
  module.hot.accept("./utils", () => {
    // This callback is called when utils.js is updated
    const newUtils = require("./utils");
    updateUI(newUtils);
  });
}
```

The reason Vue and React HMR work "automatically" is that vue-loader and react-refresh automatically inject `module.hot.accept` logic for you.

## How vue-loader Handles HMR

```javascript
// After vue-loader compiles, it roughly injects this code:
if (module.hot) {
  module.hot.accept(); // Accept updates to itself

  if (!isFirstRender) {
    // Replace old component options with new ones
    const newOptions = require("./MyComponent.vue");
    component.options = newOptions;

    // Force re-render
    component.__vue_hot__ = Date.now();
  }
}
```

## State-Preserving HMR

Vue's HMR preserves component state (`data`), updating only templates and methods.

```javascript
// Modifying MyComponent.vue's template
// After HMR: values in data remain unchanged, only the view updates

// ❌ But state gets reset in these cases (unavoidably):
// - You modified the initial values in data
// - You modified created/mounted hooks
```

## CSS HMR

CSS is simpler — style-loader replaces the `<style>` tag directly:

```javascript
// HMR code injected by style-loader
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    // Remove the old style tag
    styleElement.remove();
  });
  // Add a new style tag
}
```

## Summary

- HMR pushes update notifications via WebSocket, then fetches new modules over HTTP
- Module replacement updates the corresponding function in `__webpack_modules__`
- `module.hot.accept` declares acceptance of hot updates; vue-loader/react-refresh inject it automatically
- CSS hot updates replace the style tag directly, with no state concerns
- Falls back to a full page reload when replacement fails
