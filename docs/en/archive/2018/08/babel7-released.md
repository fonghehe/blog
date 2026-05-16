---
title: "Babel 7 Released: Upgrade Guide and New Features"
date: 2018-08-02 16:20:40
tags:
  - Babel
  - Engineering
readingTime: 2
description: "Babel 7 officially launched in August (after an extraordinarily long beta period). After upgrading several projects, here's a summary of the major changes and t"
---

Babel 7 officially launched in August (after an extraordinarily long beta period). After upgrading several projects, here's a summary of the major changes and the pitfalls I encountered.

## Major Changes

### 1. Package Rename: from `babel-*` to `@babel/*`

This is the biggest breaking change:

```bash
# Babel 6
babel-core
babel-preset-env
babel-preset-react
babel-plugin-transform-runtime

# Babel 7
@babel/core
@babel/preset-env
@babel/preset-react
@babel/plugin-transform-runtime
```

### 2. Deprecated Year-based Presets

Babel 6 had `babel-preset-es2015`, `babel-preset-es2016`, etc. Babel 7 unifies them all under `@babel/preset-env`:

```bash
npm uninstall babel-preset-es2015 babel-preset-es2016
npm install @babel/preset-env
```

### 3. Config File Format

Supports the new `babel.config.js` (project-level), more flexible:

```javascript
// babel.config.js (new recommended approach)
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: {
          browsers: ["> 1%", "last 2 versions", "not ie <= 8"],
        },
        useBuiltIns: "usage", // import polyfills on demand
        corejs: 3, // specify core-js version
      },
    ],
  ],
  plugins: [
    "@babel/plugin-transform-runtime",
    "@babel/plugin-proposal-optional-chaining", // ?. operator
    "@babel/plugin-proposal-nullish-coalescing-operator", // ?? operator
  ],
};
```

## Upgrade Steps

### Step 1: Update Dependencies

```bash
# Remove old dependencies
npm uninstall babel-core babel-preset-env babel-loader
npm uninstall babel-plugin-transform-runtime

# Install new dependencies
npm install --save-dev @babel/core @babel/preset-env
npm install --save-dev @babel/plugin-transform-runtime
npm install @babel/runtime  # runtime dependency (not devDependencies)

# Update babel-loader (compatible with Babel 7)
npm install --save-dev babel-loader@8
```

### Step 2: Update Config File

```javascript
// .babelrc (or babel.config.js)
{
  "presets": [
    ["@babel/preset-env", {
      "targets": { "browsers": ["> 1%", "last 2 versions"] },
      "useBuiltIns": "usage",
      "corejs": 3
    }]
  ]
}
```

### Step 3: Handle TypeScript (if applicable)

```bash
npm install --save-dev @babel/preset-typescript
```

```javascript
// babel.config.js
presets: ["@babel/preset-env", "@babel/preset-typescript"];
```

## New Features: Optional Chaining and Nullish Coalescing

These two proposals were available in Babel 7 beta:

```javascript
// Optional chaining (?.): access deep properties without null checks
// Before
const city = user && user.address && user.address.city;

// After Babel 7
const city = user?.address?.city;

// Function calls
callback?.();
arr?.[0];

// Nullish coalescing (??): unlike || (only handles null/undefined, not 0 or '')
const count = response.count ?? 0;
// response.count = 0 → 0 (not replaced by ??)
// response.count = null → 0 (replaced by ??)

// Difference from ||
const name = user.name || "Anonymous"; // '' is also replaced
const name = user.name ?? "Anonymous"; // only null/undefined is replaced
```

## useBuiltIns: Smarter Polyfilling

```javascript
// useBuiltIns: 'usage' — import on demand
// No need to manually import 'core-js'
// Babel analyzes what new features your code uses and auto-imports polyfills

// For example, if you use Array.from:
const arr = Array.from(set);
// Babel automatically adds to the top of the file:
// import 'core-js/modules/es.array.from'
```

## Pitfalls

**Pitfall 1: `core-js` version**

```bash
# babel 7.4+ needs core-js 3, must install explicitly
npm install core-js@3
```

```javascript
// Specify version in config
["@babel/preset-env", { useBuiltIns: "usage", corejs: 3 }];
```

**Pitfall 2: `babel-upgrade` tool**

The official upgrade tool auto-handles dependency renaming:

```bash
npx babel-upgrade --write
```

But not all config changes can be automated — review manually after running it.

**Pitfall 3: webpack's `babel-loader` version**

babel-loader 7 is not compatible with Babel 7; you need babel-loader 8:

```bash
npm install --save-dev babel-loader@8
```

## Summary

- Babel 7 fully migrates to `@babel/*` namespace
- `babel.config.js` is the new recommended config approach
- `useBuiltIns: 'usage'` automatically imports polyfills on demand
- Optional chaining `?.` and nullish coalescing `??` are very useful
- Use the `babel-upgrade` tool to handle dependency renaming before upgrading
