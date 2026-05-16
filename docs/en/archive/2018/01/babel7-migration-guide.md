---
title: "Babel 7 Migration Guide"
date: 2018-01-27 15:13:59
tags:
  - Babel
  - Engineering
readingTime: 2
description: "Babel 7 beta has been out for a while. Upgrading from version 6 to 7 involves some breaking changes, but also brings useful new features. This article documents"
---

Babel 7 beta has been out for a while. Upgrading from version 6 to 7 involves some breaking changes, but also brings useful new features. This article documents the actual upgrade process and the pitfalls encountered.

## Major Changes in Babel 7

### 1. Scoped Package Names

All official packages now live under the `@babel/` namespace:

```bash
# Babel 6
babel-core
babel-cli
babel-preset-env
babel-preset-react

# Babel 7
@babel/core
@babel/cli
@babel/preset-env
@babel/preset-react
```

### 2. Improved `@babel/preset-env`

```json
// babel.config.js (Babel 7 recommended format)
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: { browsers: ["> 1%", "last 2 versions"] },
      useBuiltIns: 'usage',  // auto-import only needed polyfills (new)
      corejs: 3,             // specify core-js version (new)
      modules: false         // preserve ES Modules for Tree Shaking
    }]
  ]
}
```

`useBuiltIns: 'usage'` analyzes your code and only imports the polyfills you actually need, instead of loading the entire `@babel/polyfill`.

### 3. Project-Level Config: babel.config.js

Babel 6's `.babelrc` only applied to its directory and subdirectories, which was problematic in monorepo projects. Babel 7 introduces `babel.config.js` at the project root:

```javascript
// babel.config.js
module.exports = function (api) {
  api.cache(true);

  const presets = [
    [
      "@babel/preset-env",
      {
        targets: { node: "current" },
        modules: "commonjs",
      },
    ],
  ];

  const plugins = [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
  ];

  return { presets, plugins };
};
```

## Upgrade Steps

### Step 1: Update Dependencies

```bash
# Remove old packages
npm uninstall babel-core babel-cli babel-preset-env babel-preset-react

# Install new packages
npm install --save-dev @babel/core @babel/cli @babel/preset-env @babel/preset-react \
  @babel/plugin-proposal-class-properties @babel/plugin-proposal-object-rest-spread

# Install polyfill
npm install @babel/polyfill core-js@3
```

### Step 2: Update Configuration

```javascript
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "usage",
        corejs: 3,
        modules: false,
      },
    ],
    "@babel/preset-react",
  ],
  plugins: [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
  ],
  env: {
    test: {
      presets: [["@babel/preset-env", { targets: { node: "current" } }]],
    },
  },
};
```

### Step 3: Update Webpack Integration

```bash
npm install --save-dev babel-loader  # babel-loader 8.x is Babel 7 compatible
```

```javascript
// webpack.config.js
module: {
  rules: [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          cacheDirectory: true,
        },
      },
    },
  ];
}
```

## Common Pitfalls

**Pitfall 1: `@babel/polyfill` is deprecated**

Since Babel 7.4, `@babel/polyfill` is deprecated. Import directly:

```javascript
// Before
import "@babel/polyfill";

// After (or let useBuiltIns: 'usage' handle it automatically)
import "core-js/stable";
import "regenerator-runtime/runtime";
```

**Pitfall 2: Class Properties Syntax**

```javascript
class MyComponent extends React.Component {
  state = { count: 0 }; // class fields (stage-3)
  handleClick = () => {}; // arrow function property
}
```

Requires `@babel/plugin-proposal-class-properties`. Be aware of the difference in `loose` mode.
