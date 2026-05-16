---
title: "Webpack 4 Official Release: Zero Config Experience and Upgrade Guide"
date: 2018-02-03 11:07:33
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "Webpack 4 was officially released at the end of February. The biggest highlight is **zero configuration** — you can get it running without writing a config file"
---

Webpack 4 was officially released at the end of February. The biggest highlight is **zero configuration** — you can get it running without writing a config file. After upgrading several projects, here are my notes on the real-world experience.

## The Most Obvious Change: mode

Webpack 4 introduces the `mode` parameter, which accepts `development` or `production`:

```bash
webpack --mode production
webpack --mode development
```

`production` mode automatically enables:

- `TerserPlugin` (code minification)
- `ModuleConcatenationPlugin` (Scope Hoisting)
- `NoEmitOnErrorsPlugin`
- Various other optimizations

`development` mode automatically enables:

- `NamedChunksPlugin`
- `NamedModulesPlugin`
- Better error messages

Previously all of this required manual configuration. Now setting `mode` is enough for most projects.

## Build Speed Improvements

The official claim is 98% faster (under extreme test conditions). Real-world projects show 30%–60% improvement — still very noticeable.

Main reasons:

- Persistent cache (`cache` option)
- Improved module resolution algorithm
- Reduced plugin internal overhead

## Upgrade Steps

### 1. Update Dependencies

```bash
npm uninstall webpack webpack-dev-server
npm install webpack@4 webpack-cli@3 webpack-dev-server@3

# webpack-cli is now separate from webpack — install it explicitly
```

### 2. Update package.json scripts

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack-dev-server --mode development --open"
  }
}
```

### 3. Remove Deprecated Config

Webpack 4 removed some old APIs:

```javascript
// Before
module.exports = {
  entry: './src/index.js',
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({ ... })  // ❌ removed
    new webpack.optimize.UglifyJsPlugin()             // ❌ removed
  ]
}

// After
module.exports = {
  entry: './src/index.js',
  mode: 'production',
  optimization: {
    splitChunks: {           // ✅ replacement for CommonsChunkPlugin
      chunks: 'all'
    }
  }
  // UglifyJS is automatically enabled in production mode
}
```

### 4. Update mini-css-extract-plugin

The old `extract-text-webpack-plugin` has compatibility issues with Webpack 4 — switch to the new one:

```bash
npm install mini-css-extract-plugin
```

```javascript
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
  ],
};
```

## splitChunks: The New CommonsChunkPlugin Replacement

This is the biggest change. The new `optimization.splitChunks` is more flexible:

```javascript
module.exports = {
  optimization: {
    splitChunks: {
      chunks: "all", // 'async' | 'initial' | 'all'
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: -10,
        },
        common: {
          name: "common",
          minChunks: 2, // extract only if used by at least 2 entry points
          chunks: "initial",
          priority: -20,
        },
      },
    },
  },
};
```

## Upgrade Pitfalls

**Issue 1: Loader throws `this.getOptions is not a function`**

Cause: some older loaders haven't been adapted for Webpack 4. Upgrade the loader versions.

**Issue 2: `vue-loader` needs an upgrade**

```bash
npm install vue-loader@15 vue-template-compiler
```

Vue Loader 15 requires `VueLoaderPlugin`:

```javascript
const { VueLoaderPlugin } = require("vue-loader");

module.exports = {
  plugins: [
    new VueLoaderPlugin(), // required, otherwise .vue files won't be parsed
  ],
};
```

**Issue 3: `webpack-dev-server` config options renamed**

```javascript
// Webpack 3
devServer: {
  contentBase: "./dist";
}

// Webpack 4
devServer: {
  static: "./dist"; // contentBase renamed to static (some versions)
}
```

## Summary

Upgrading to Webpack 4 is worth it — build speed and bundle size both improve. The main cost is dealing with plugin/loader compatibility issues. I recommend testing it on a small project first before migrating a large one.
