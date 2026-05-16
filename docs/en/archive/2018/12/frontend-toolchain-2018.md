---
title: "2018 Frontend Toolchain Summary"
date: 2018-12-24 17:28:57
tags:
  - Frontend
readingTime: 2
description: "Year-end is a good time to round up the frontend tools I used this year, along with their positioning and selection rationale."
---

Year-end is a good time to round up the frontend tools I used this year, along with their positioning and selection rationale.

## Build Tools

**Webpack 4** (primary)

- Best for: complex applications needing code splitting, tree-shaking, and various loaders
- Characteristics: most comprehensive features, richest ecosystem, most complex config
- 2018 milestone: version 4.0 (released in February) significantly improved build speed

**Parcel** (backup)

- Best for: quick prototypes and simple projects; zero-config
- Characteristics: works out-of-the-box with no config file
- Used once for an internal tool — genuinely fast

**Rollup** (library bundling)

- Best for: packaging JS libraries; produces clean ESM/CJS output
- Characteristics: earlier tree-shaking support than Webpack; smaller bundles
- My choice when publishing npm packages

## Package Management

**yarn** (current primary)

- More reliable lockfile; faster installs
- Workspace support for monorepos

**npm 6** (also in use)

- Speed much improved after this year's updates
- `package-lock.json` more solid now

## Code Quality

**ESLint**

- Uses `eslint-config-airbnb` as the base ruleset
- Paired with `eslint-plugin-vue` for Vue projects
- Pre-commit check with `lint-staged`

**Prettier**

- Unified code formatting
- Combined with ESLint: ESLint handles logic errors, Prettier handles formatting

**husky + lint-staged**

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,vue}": ["eslint --fix", "git add"],
    "*.{css,scss}": ["stylelint --fix", "git add"]
  }
}
```

## Frameworks and Libraries

**Vue 2.5** (work projects)

- Vuex 3.x
- Vue Router 3.x
- Element UI (desktop)
- Vant (mobile)

**React 16.x** (self-study)

- Redux + Redux Thunk
- React Router v4

**TypeScript 3.x**

- Started using on new projects this year
- Type safety really is worth it

## HTTP

**axios** (nearly every project)

- Wrapped interceptors for unified auth and error handling
- Supports request cancellation

## Testing

**Jest** (unit testing)

- Paired with Vue Test Utils

**Cypress** (E2E, just getting started)

- Can record user interactions to generate tests

## Developer Experience

**VS Code** (primary editor)

- Vetur (Vue support)
- ESLint plugin
- Prettier plugin
- GitLens

**Chrome DevTools**

- Performance panel (performance analysis)
- Network panel (network analysis)
- Memory panel (memory leak investigation)

## Summary

The 2018 toolchain has stabilized. Webpack 4 + Vue 2 + TypeScript + ESLint + Prettier is the core stack for new projects. Differences across projects are mainly in styling solution (Sass / Less / CSS Modules) and test frameworks.

Looking ahead to 2019: Webpack 5 and Vue 3 are both in the works. Snowpack's ESM-based dev server concept is worth watching. React Hooks will change how React projects are written.
