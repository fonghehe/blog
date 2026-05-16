---
title: "Automating Workflows with npm Scripts"
date: 2018-07-12 17:30:27
tags:
  - TypeScript
readingTime: 1
description: "Many people only use npm scripts for `npm start` and `npm run build`, but they can do a lot more for automation."
---

Many people only use npm scripts for `npm start` and `npm run build`, but they can do a lot more for automation.

## Basics

```json
{
  "scripts": {
    "dev": "webpack-dev-server --mode development",
    "build": "webpack --mode production",
    "lint": "eslint src --ext .js,.vue",
    "test": "jest"
  }
}
```

Run: `npm run dev` (`start` and `test` can skip the `run`)

## Sequential and Parallel Execution

```json
{
  "scripts": {
    // Sequential: && stops if the previous command fails
    "build": "npm run lint && npm run compile && npm run minify",

    // Parallel: & runs simultaneously (Unix), or use npm-run-all
    "dev": "npm run server & npm run watch",

    // npm-run-all (cross-platform)
    "dev": "npm-run-all --parallel server watch",
    "build": "npm-run-all lint compile minify"
  }
}
```

```bash
npm install --save-dev npm-run-all
```

## Passing Arguments

```bash
# Arguments after -- are passed to the script
npm run build -- --watch
npm run lint -- --fix
```

```json
{
  "scripts": {
    "lint": "eslint src",
    "lint:fix": "npm run lint -- --fix"
  }
}
```

## Lifecycle Hooks

npm provides pre/post hooks:

```json
{
  "scripts": {
    "prebuild": "npm run clean", // auto-runs before build
    "build": "webpack --mode production",
    "postbuild": "npm run zip-dist", // auto-runs after build

    "pretest": "npm run lint", // lint before testing
    "test": "jest"
  }
}
```

## Useful Script Collection

```json
{
  "scripts": {
    // Clean build directory
    "clean": "rimraf dist",

    // Analyze bundle size
    "analyze": "webpack-bundle-analyzer stats.json",

    // Check for dependency updates
    "deps:check": "ncu",
    "deps:update": "ncu -u && npm install",

    // Generate changelog
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",

    // Version releases
    "release:patch": "npm version patch && npm publish",
    "release:minor": "npm version minor && npm publish",

    // Auto-open browser after starting
    "dev": "webpack-dev-server --open",

    // Format all files
    "format": "prettier --write \"src/**/*.{js,vue,css,scss}\"",

    // Full check (for CI)
    "ci": "npm run lint && npm run test && npm run build"
  }
}
```

## Environment Variables

```json
{
  "scripts": {
    // cross-env sets environment variables cross-platform
    "build:staging": "cross-env NODE_ENV=production VUE_APP_ENV=staging webpack",
    "build:prod": "cross-env NODE_ENV=production VUE_APP_ENV=production webpack"
  }
}
```

```bash
npm install --save-dev cross-env rimraf
```

## Running Node Scripts

Run Node scripts directly from scripts:

```json
{
  "scripts": {
    "gen-icons": "node scripts/generate-icons.js",
    "update-version": "node -e \"require('./scripts/bump-version')()\"",
    "check-size": "node -e \"const s = require('./dist/main.js').length; console.log('Size:', (s/1024).toFixed(1)+'KB')\""
  }
}
```

## Summary

- `pre`/`post` hooks for automatic chaining
- `npm-run-all` for parallel/sequential tasks, cross-platform
- `cross-env` for setting environment variables cross-platform
- Write common operations as scripts to document and standardize team workflows
