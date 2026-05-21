---
title: "The Complete Workflow for Publishing an npm Package"
date: 2019-06-26 09:37:41
tags:
  - Node.js
readingTime: 1
description: "Writing a utility and copy-pasting it into every project is inefficient. Once it's stable enough, publish it to npm and install it like any other package. This "
wordCount: 115
---

Writing a utility and copy-pasting it into every project is inefficient. Once it's stable enough, publish it to npm and install it like any other package. This article covers the complete workflow from project initialization to publishing.

## Project Initialization

```bash
mkdir my-utils && cd my-utils
npm init
# Or use the shortcut for all defaults:
npm init -y
```

## Key package.json Fields

```json
{
  "name": "@yourname/my-utils", // Scoped package to avoid name conflicts
  "version": "1.0.0",
  "description": "A collection of utility functions",
  "main": "dist/index.cjs.js", // CommonJS entry (Node.js/Webpack)
  "module": "dist/index.esm.js", // ES Module entry (bundler tree-shaking)
  "types": "dist/index.d.ts", // TypeScript types
  "files": [
    // Files to include when publishing
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "rollup -c",
    "test": "jest",
    "prepublishOnly": "npm run build && npm test" // auto-run before publish
  },
  "keywords": ["utils", "helpers"],
  "license": "MIT",
  "devDependencies": {
    "rollup": "^1.0.0",
    "jest": "^24.0.0"
  }
}
```

## files vs .npmignore

Two ways to control which files get published:

```
# .npmignore (like .gitignore, but for npm)
src/
tests/
*.test.js
.eslintrc.js
rollup.config.js
```

**Recommendation: use the `files` field in package.json** — it's more explicit. Only what's listed gets published. `.npmignore` is a blocklist, which can accidentally include files you don't want.

## Versioning with semver

```bash
# 1.0.0 → 1.0.1 (patch: bug fix)
npm version patch

# 1.0.0 → 1.1.0 (minor: new feature, backward compatible)
npm version minor

# 1.0.0 → 2.0.0 (major: breaking change)
npm version major
```

## Publishing

```bash
# Login first
npm login

# Publish to the public registry
npm publish --access public  # --access public is required for scoped packages

# Publish a beta version
npm publish --tag beta
# Install beta: npm install @yourname/my-utils@beta
```

## Verify the Package

```bash
# Preview the files that would be published (dry run)
npm pack --dry-run

# Or publish to local registry with verdaccio for testing
```

A good open-source package needs: a clear README, TypeScript types, a changelog, and test coverage. Focus on the README first — it's the first thing users see.
