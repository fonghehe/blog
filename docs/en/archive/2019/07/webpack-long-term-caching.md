---
title: "Webpack DllPlugin: Accelerating Build Speed"
date: 2019-07-29 14:58:32
tags:
  - Webpack
  - Engineering
readingTime: 2
description: "As projects grow, Webpack build times can become painfully slow. Every time you modify code, even a small change triggers rebundling of all vendor libraries. Dl"
wordCount: 214
---

As projects grow, Webpack build times can become painfully slow. Every time you modify code, even a small change triggers rebundling of all vendor libraries. DllPlugin solves this by pre-compiling stable third-party libraries into a separate "DLL" bundle, which is reused across builds without recompilation.

## How DllPlugin Works

DllPlugin works in two steps:

1. **Pre-compile** vendor libraries into a DLL bundle + manifest file (run once, or when dependencies change)
2. **Reference** the DLL manifest in your main webpack config, skipping those modules

## Step 1: Create DLL Config

Create `webpack.dll.config.js`:

```javascript
const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  entry: {
    vendor: [
      "react",
      "react-dom",
      "react-router-dom",
      "axios",
      "lodash",
      "moment",
    ],
  },
  output: {
    path: path.resolve(__dirname, "dll"),
    filename: "[name].dll.js",
    library: "[name]_[fullhash]", // Expose as global variable
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_[fullhash]", // Must match output.library
      path: path.resolve(__dirname, "dll", "[name].manifest.json"),
    }),
  ],
};
```

Run this once to generate the DLL files:

```bash
webpack --config webpack.dll.config.js
```

This generates:

- `dll/vendor.dll.js` — the pre-compiled bundle
- `dll/vendor.manifest.json` — the module manifest

## Step 2: Reference DLL in Main Config

```javascript
const path = require("path");
const webpack = require("webpack");
const AddAssetHtmlPlugin = require("add-asset-html-webpack-plugin");

module.exports = {
  // ... your regular config
  plugins: [
    new webpack.DllReferencePlugin({
      manifest: require("./dll/vendor.manifest.json"),
    }),

    // Automatically inject DLL script into HTML
    new AddAssetHtmlPlugin({
      filepath: path.resolve(__dirname, "dll/vendor.dll.js"),
      publicPath: "/dll",
      outputPath: "dll",
    }),
  ],
};
```

## Multiple DLL Files

Split DLLs by category for better cache granularity:

```javascript
// webpack.dll.config.js
module.exports = {
  entry: {
    react: ["react", "react-dom", "react-router-dom"],
    utils: ["axios", "lodash", "moment", "dayjs"],
    ui: ["antd", "@ant-design/icons"],
  },
  output: {
    library: "[name]_[fullhash]",
    filename: "[name].dll.js",
    path: path.resolve(__dirname, "dll"),
  },
  plugins: [
    new webpack.DllPlugin({
      name: "[name]_[fullhash]",
      path: path.resolve(__dirname, "dll", "[name].manifest.json"),
    }),
  ],
};

// webpack.config.js — reference all manifests
module.exports = {
  plugins: [
    new webpack.DllReferencePlugin({
      manifest: require("./dll/react.manifest.json"),
    }),
    new webpack.DllReferencePlugin({
      manifest: require("./dll/utils.manifest.json"),
    }),
    new webpack.DllReferencePlugin({
      manifest: require("./dll/ui.manifest.json"),
    }),
    new AddAssetHtmlPlugin([
      { filepath: path.resolve(__dirname, "dll/react.dll.js") },
      { filepath: path.resolve(__dirname, "dll/utils.dll.js") },
      { filepath: path.resolve(__dirname, "dll/ui.dll.js") },
    ]),
  ],
};
```

## npm Scripts

```json
{
  "scripts": {
    "dll": "webpack --config webpack.dll.config.js",
    "build": "webpack --config webpack.config.js",
    "build:full": "npm run dll && npm run build"
  }
}
```

Only run `npm run dll` when you update dependencies. Regular development only needs `npm run build`.

## Before vs After

| Metric        | Before DllPlugin | After DllPlugin |
| ------------- | ---------------- | --------------- |
| Initial build | ~120s            | ~15s            |
| Rebuild       | ~80s             | ~8s             |
| Incremental   | ~25s             | ~3s             |

Results vary by project size, but DllPlugin typically reduces build time by 60–80%.

## Summary

- DllPlugin pre-compiles stable vendor libraries once, reusing them in subsequent builds
- `DllPlugin` generates the manifest, `DllReferencePlugin` references it
- Split DLLs by category (react, utils, ui) for better cache granularity
- Only re-run DLL generation when dependencies change
