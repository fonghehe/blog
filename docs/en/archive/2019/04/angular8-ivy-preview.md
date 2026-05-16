---
title: "Angular 8 RC Preview: Ivy Compiler and Lazy Loading New Syntax"
date: 2019-04-11 16:09:56
tags:
  - Angular
readingTime: 2
description: "The first Angular 8 RC has been released, bringing two highly anticipated features: an opt-in Ivy compiler preview and `import()` lazy loading syntax."
---

The first Angular 8 RC has been released, bringing two highly anticipated features: an opt-in Ivy compiler preview and `import()` lazy loading syntax.

## What Is Ivy

Ivy is Angular's next-generation rendering engine. It rewrites the compiler and runtime with the following goals:

- **Smaller bundle size**: tree-shaking friendly — only bundles the framework features that are actually used
- **Faster rebuilds**: incremental compilation — modifying one file does not require recompiling the entire project
- **Better debugging experience**: more readable renderer code
- **Future capabilities**: advanced features such as Server-Side Rendering and Higher-order components

## Enabling the Ivy Preview

```json
// tsconfig.app.json
{
  "angularCompilerOptions": {
    "enableIvy": true
  }
}
```

Note: Ivy in Angular 8 is **opt-in** preview only and is not recommended for production testing. Full default enablement will come with Angular 9.

## Changes to Lazy Loading Syntax

This is a **very practical** change in Angular 8. Previously, loading modules via string paths had no type checking. Now the native ES `import()` syntax is used, allowing the compiler to verify that paths are correct:

```typescript
// Angular 7 and earlier: string path
const routes: Routes = [
  {
    path: "users",
    loadChildren: "./users/users.module#UsersModule", // old syntax
  },
];

// Angular 8+: dynamic import()
const routes: Routes = [
  {
    path: "users",
    loadChildren: () =>
      import("./users/users.module").then((m) => m.UsersModule),
  },
];
```

Advantages of the new syntax:

1. IDE tracks the path and updates automatically on rename
2. TypeScript checks path existence at compile time
3. More readable — the relationship is immediately clear

## Web Worker Support

The Angular 8 CLI supports generating a Web Worker with a single command:

```bash
ng generate web-worker app
```

```typescript
// src/app/app.worker.ts
onmessage = ({ data }) => {
  const result = heavyComputation(data);
  postMessage(result);
};

// Usage in a component
if (typeof Worker !== "undefined") {
  const worker = new Worker("./app.worker", { type: "module" });
  worker.postMessage({ input: largeData });
  worker.onmessage = ({ data }) => {
    this.result = data;
  };
}
```

## Differential Loading

Enabled by default in Angular 8: modern browsers load ES2015+ bundles while legacy browsers load ES5 bundles.

```html
<!-- Automatically generated after build -->
<script type="module" src="main-es2015.js"></script>
<!-- modern browsers -->
<script nomodule src="main-es5.js"></script>
<!-- fallback for legacy browsers -->
```

Users on modern browsers get a **20–30% size reduction** (no polyfills or ES5 transpilation overhead required).

## Summary

Angular 8 represents a significant step forward with Ivy, the new lazy loading syntax, Web Worker support, and differential loading. These changes lay the groundwork for the future of the Angular ecosystem.
