---
title: "Monorepo in Practice: Managing Multi-package Projects with Lerna"
date: 2018-10-23 17:02:40
tags:
  - Micro-frontend
  - Engineering
readingTime: 2
description: "Our company had several interdependent projects managed in separate repositories, which made local integration and version synchronization painful. After resear"
wordCount: 205
---

Our company had several interdependent projects managed in separate repositories, which made local integration and version synchronization painful. After researching Monorepo, Lerna turned out to be the most mainstream solution.

## Monorepo vs Multirepo

**Multirepo**: one git repository per project/package

- Pros: clear ownership, teams don't interfere with each other
- Cons: cross-package changes require multiple PRs, local integration is complex, version management is difficult

**Monorepo**: multiple packages in one git repository

- Pros: atomic commits, unified versioning, easy local integration
- Cons: larger repository, CI needs more configuration

## Lerna Basics

```bash
npm install -g lerna
npx lerna init
```

Generated structure:

```
my-monorepo/
├── packages/
│   ├── components/       # @myorg/components
│   ├── utils/            # @myorg/utils
│   └── admin/            # @myorg/admin (depends on the two above)
├── lerna.json
└── package.json
```

```json
// lerna.json
{
  "version": "independent", // each package has its own version
  "npmClient": "npm",
  "packages": ["packages/*"]
}
```

## Common Commands

```bash
# Create a new package
npx lerna create @myorg/utils packages/utils

# Install a dependency into a specific package
npx lerna add lodash --scope=@myorg/components

# Cross-package dependency (uses symlinks, no publishing required)
npx lerna add @myorg/utils --scope=@myorg/admin

# Run a command in all packages
npx lerna run build          # run npm run build in all packages
npx lerna run test           # run npm run test in all packages
npx lerna run build --scope=@myorg/components  # run only in one package

# Publish
npx lerna publish
# Automatically: detects changed packages → bumps versions → updates deps → publishes to npm → tags git
```

## Combining with Yarn Workspaces

Lerna + Yarn Workspaces is currently the most popular combination:

```json
// Root package.json
{
  "private": true,
  "workspaces": ["packages/*"]
}

// lerna.json
{
  "npmClient": "yarn",
  "useWorkspaces": true
}
```

Yarn Workspaces handles dependency hoisting (lifting shared deps to the root), while Lerna handles version publishing.

```bash
yarn install  # installs all dependencies once; common deps are shared
```

## Example Structure

```
packages/
├── ui/
│   ├── src/
│   │   ├── Button/
│   │   ├── Input/
│   │   └── index.ts
│   └── package.json
│       → { "name": "@myorg/ui", "version": "1.0.0" }
│
├── utils/
│   ├── src/
│   │   ├── format.ts
│   │   └── request.ts
│   └── package.json
│       → { "name": "@myorg/utils", "version": "1.0.0" }
│
└── admin-app/
    ├── src/
    └── package.json
        → { "dependencies": {
              "@myorg/ui": "^1.0.0",      // local package, symlink
              "@myorg/utils": "^1.0.0"    // local package, symlink
            } }
```

## Pain Points

- CI build times grow as the repo grows (need per-package affected detection)
- IDE performance may degrade (very large node_modules)
- Each package needs its own build tool configuration

Lerna 6.x has improved support for these issues (affected detection, task pipelines).

## Summary

- Monorepo suits multi-package projects with interdependencies
- Lerna handles version publishing; Yarn Workspaces handles dependency management
- `lerna run build` builds all packages in topological order
- Local packages reference each other via symlinks — no need to publish to npm for local development
