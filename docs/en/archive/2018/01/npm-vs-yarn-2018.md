---
title: "npm vs yarn: The 2018 Choice"
date: 2018-01-20 11:10:29
tags:
  - Node.js
readingTime: 1
description: "When yarn first came out in 2016, npm's problems (slow installs, no lockfile, non-deterministic dependency trees) made yarn the obvious winner. Two years later,"
---

When yarn first came out in 2016, npm's problems (slow installs, no lockfile, non-deterministic dependency trees) made yarn the obvious winner. Two years later, npm 5 closed the gap significantly. Which should you use now?

## Why yarn Was Born

The main problems with npm 3:

- No lockfile: different team members could get different dependency versions
- Slow: no parallel downloads, no caching
- Non-deterministic: `npm install` could produce different results

yarn solved all three at once:

- `yarn.lock` — deterministic dependency tree
- Parallel downloads + caching — dramatically faster
- Flat dependency resolution

## npm 5+ Caught Up

npm 5 (Node.js 8 era) added `package-lock.json` and improved speed significantly. The gap narrowed considerably.

## 2018 Comparison

| Feature            | npm 5                 | yarn          |
| ------------------ | --------------------- | ------------- |
| Lockfile           | `package-lock.json`   | `yarn.lock`   |
| Install speed      | Fast                  | Fast          |
| Workspaces         | ❌ (npm 7 added this) | ✅ (built-in) |
| Offline mode       | ❌                    | ✅            |
| Output readability | OK                    | Better        |

## Command Syntax

```bash
# Install
npm install            yarn
npm install --save     yarn add [package]
npm install --save-dev yarn add --dev [package]
npm install -g         yarn global add [package]

# Remove
npm uninstall          yarn remove

# Run scripts
npm run [script]       yarn [script]  (no 'run' needed)

# Update
npm update             yarn upgrade
```

## Workspaces (monorepo)

yarn's built-in workspace support is a real advantage for monorepos:

```json
// package.json (root)
{
  "private": true,
  "workspaces": ["packages/*"]
}
```

```bash
# Install all workspace dependencies
yarn install

# Run a command in a specific workspace
yarn workspace my-package test
```

## Lockfile Best Practices

Regardless of which you choose:

1. **Commit your lockfile** — `package-lock.json` or `yarn.lock`
2. Never mix npm and yarn in the same project — they'll generate conflicting lockfiles
3. Use the same package manager version across the team

## My Recommendation (2018)

- **New project**: either works, just be consistent
- **Monorepo**: yarn (workspaces are far superior)
- **Simple project without monorepo**: npm 5 is fine

The most important thing is team consistency. Mixing package managers causes lockfile conflicts and non-deterministic installs.
