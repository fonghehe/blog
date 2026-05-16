---
title: "Webpack DllPlugin: Speed Up Development Builds"
date: 2018-02-21 15:30:47
tags:
  - Webpack
readingTime: 2
description: "As projects grow larger, Webpack cold starts get slower. The idea behind DllPlugin is to build rarely-changing third-party libraries separately, so they don't n"
---

As projects grow larger, Webpack cold starts get slower. The idea behind DllPlugin is to build rarely-changing third-party libraries separately, so they don't need to be reprocessed on every build.

## Why DllPlugin

```
Every webpack build processes:
  - Business code (changes frequently)
  - Third-party libs like React/Vue/lodash/echarts (rarely change)

DllPlugin approach:
  - Build third-party libs once → produce vendor.js + manifest.json
  - Subsequent builds reference the pre-built vendor.js
  - Skip processing third-party libs → build speed dramatically improves
```

## Configuration Steps

### Step 1: Create the DLL Config File

```javascript
// webpack.dll.js
const path = require("path");
const webpack = require("webpack");

module.exports = {
  entry: {
    vendor: ["vue", "vue-router", "vuex", "axios", "lodash"],
  },
  output: {
    path: path.join(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_lib", // exposed global variable name
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_lib",
      path: path.join(__dirname, "dll", "[name]-manifest.json"),
    }),
  ],
};
```

### Step 2: Generate the DLL Files

```bash
# Add a script to package.json
"scripts": {
  "dll": "webpack --config webpack.dll.js"
}

# Run (only needed when dependency versions change)
npm run dll
```

This produces:

- `dll/vendor.dll.js`
- `dll/vendor-manifest.json`

### Step 3: Reference the DLL in the Main Config

```javascript
// webpack.config.js
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const AddAssetHtmlPlugin = require("add-asset-html-webpack-plugin");

module.exports = {
  plugins: [
    // Tell webpack which modules to skip and look up in the DLL instead
    new webpack.DllReferencePlugin({
      manifest: require("./dll/vendor-manifest.json"),
    }),

    new HtmlWebpackPlugin({ template: "index.html" }),

    // Automatically inject the DLL file into HTML
    new AddAssetHtmlPlugin({
      filepath: require.resolve("./dll/vendor.dll.js"),
    }),
  ],
};
```

## Performance Comparison

On my project (with Vue, echarts, moment, etc.):

```
Without DllPlugin: cold start ~18s
With DllPlugin:    cold start ~7s

Approximately 60% faster
```

## Things to Note

```javascript
// 1. Re-run npm run dll when dependency versions in the DLL change
// 2. Add the dll directory to .gitignore — each person generates it locally
// 3. DllPlugin is generally not used for production builds (CI always does a full build)

// .gitignore
dll/
```

## 2018 Context

DllPlugin was one of the most effective build acceleration techniques at the time (2018). However, after Webpack 4 introduced `cache` and `parallel` options, the gain from DllPlugin became relatively smaller. If you're on Webpack 4, try `cache-loader` and `thread-loader` first — they might be sufficient.

## Summary

- DllPlugin builds third-party libs separately; the main build skips processing them
- Steps: create dll config → run once to generate dll → reference manifest in main config
- Best for: projects with slow cold starts and many third-party dependencies
- Webpack 4 has simpler caching solutions — evaluate whether you need DllPlugin first
