---
title: "H1 2018: Building the Engineering System and Deep-Diving into Vue"
date: 2018-06-28 10:43:27
tags:
  - Frontend
readingTime: 5
description: "The core work in the first half of 2018 revolved around three things: upgrading the architecture of back-office systems, building an internal component library "
---

The core work in the first half of 2018 revolved around three things: upgrading the architecture of back-office systems, building an internal component library from scratch, and improving the engineering pipeline. Here is a systematic retrospective recording the thinking behind technology choices and the real pitfalls we encountered.

## H1 Key Project Review

### Back-office System: Webpack 3 → 4 Migration + Incremental TypeScript Adoption

At the start of the year I took over a two-year-old back-office system running Webpack 3 + Vue 2.3, with a stable build time of around 45 seconds. I faced two choices: patch it and keep going, or do a thorough engineering upgrade. Considering the team would need to maintain multiple back-office projects in parallel, I chose the latter.

The core win from **upgrading to Webpack 4** wasn't the version number itself — it was the `mode` mechanism and improved Tree Shaking. The biggest resistance during migration came from plugin ecosystem compatibility: several Webpack 3 plugins hadn't caught up to 4.x yet, requiring replacements or custom adapters. Build time ultimately dropped from 45s to 12s, with two main contributors:

```js
// webpack.config.js key config
module.exports = {
  mode: "production",
  optimization: {
    splitChunks: {
      chunks: "all",
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
};
```

Adding `HardSourceWebpackPlugin` for persistent caching and route lazy-loading made the hot-reload experience in development much better.

**Incremental TypeScript migration** was a longer-term investment. The legacy code was full of `any` types — there was no way to fix everything at once. The strategy: enforce TS on new modules, gradually cover old modules via `allowJs`. By end of June, core module coverage was around 60%. The biggest takeaway from this process was understanding that the type system isn't a "constraint" — it's a compile-time contract and documentation, especially valuable in multi-person collaboration where type definitions are the best interface specification.

## Component Library Construction

The first half of the year saw us kick off an internal shared component library. The goal wasn't to build a new UI framework, but to wrap business-layer common components on top of Element UI: permission buttons, data dictionary selectors, complex search forms, general CRUD tables, etc.

Several key design decisions were made:

- **Props-driven, non-invasive to business logic**: components only care about UI and data flow; business logic is delegated out via slots and events
- **TypeScript type exports**: each component also exports type definitions so consumers get full type hints
- **Tree-shakeable imports**: paired with `babel-plugin-component` to avoid full bundle imports

```ts
// Component type export example
export interface CrudTableProps {
  columns: ColumnConfig[];
  fetchApi: (params: QueryParams) => Promise<PaginatedResult<any>>;
  rowKey?: string;
  toolbar?: ToolbarConfig[];
}
```

By end of June, the component library covered 70% of common use cases across 3 back-office projects, reducing new project initialization time by about 40%.

## Engineering Improvements

### CI Integration

Previously the team deployed by manually running `npm run build` and then `scp`-ing to the server — very risky. In the first half of the year we integrated GitLab CI, with a pipeline covering lint → test → build → deploy four stages. Key config:

```yaml
# .gitlab-ci.yml core pipeline
stages:
  - lint
  - test
  - build
  - deploy

lint:
  stage: lint
  script:
    - npm run lint
    - npm run type-check

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/
```

The deploy step sends DingTalk notifications — failed builds automatically @ the relevant developers. Incident tracing changed from "who deployed it?" to "which MR introduced it?".

### Code Quality Toolchain

Rolling out ESLint + Prettier took longer than expected — the core conflict wasn't the rules themselves, but the cost of reformatting legacy code. The final strategy: enable `lint-staged` to only check changed files; handle legacy code with a one-off bulk-format PR. Pairing with `commitlint` to standardize commit messages noticeably improved code review efficiency.

## Pitfalls We Hit

**1. TypeScript and Vue Compatibility Issues**

Vue 2.x's TypeScript support isn't perfect. `vue-property-decorator`'s decorator syntax loses type inference in some scenarios, especially with mixins and provide/inject. The solution: replace mixins with composition-style patterns where possible, and explicitly declare types for provide/inject.

**2. Webpack 4 `sideEffects` Configuration**

Debugging why Tree Shaking wasn't working took half a day. The root cause: `sideEffects: false` wasn't declared in `package.json`. Adding it reduced bundle size by another 15%. The lesson: upgrading toolchain means you can't just change config files — you also need to check the `package.json` of your dependencies.

**3. Nuxt.js SSR Pitfalls**

When using Nuxt for a content site's SEO, `window is not defined` kept appearing. The root cause was third-party libraries accessing browser APIs at the module's top level. The solution: use `process.client` guards, or dynamically `require` them in the `mounted` hook. This taught me: SSR isn't just swapping frameworks — your entire dependency chain needs to be adapted.

## H2 Plans

**Technical Depth:**

- TypeScript advanced type system: generic constraints, conditional types, template literal types — put them into practice in the component library
- Track React ecosystem: React 16.7 Hooks are worth diving into; planning to validate with an internal project
- Frontend testing: currently only scattered unit tests; goal is to build automated testing for the component library + CI integration

**Engineering System:**

- Integrate frontend monitoring with Sentry, covering error capture and performance metric reporting
- Micro-frontend research: as back-office systems multiply, evaluate qiankun / single-spa feasibility
- Dockerize build environment to unify the team's Node version and build dependencies

**Technical Influence:**

- Give 2–3 internal tech talks (Webpack optimization, TypeScript practices)
- Build component library documentation site to lower the onboarding cost for new members

## Summary

- Completed Webpack 4 upgrade and incremental TypeScript migration for the back-office system; build efficiency improved 73%
- Launched the business component library, covering common use cases across 3 projects
- Rolled out GitLab CI pipeline and code quality toolchain; said goodbye to manual deployments
- Solved real problems: Vue + TypeScript compatibility, Webpack Tree Shaking, Nuxt SSR, and more
- H2 focus: React validation, testing system, monitoring system, micro-frontend research
