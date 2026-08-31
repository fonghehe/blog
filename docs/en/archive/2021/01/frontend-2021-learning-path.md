---
title: "Frontend Engineer's 2021 Learning Path: Go Deep, Not Wide"
date: 2021-01-03 14:44:50
tags:
  - Frontend
  - Engineering
  - Vue
  - Angular
  - TypeScript
  - Node.js
  - Testing

readingTime: 3
description: "The first week of the new year is a good time for technical planning. 2020 brought a lot of change — Vue 3, Angular 11, webpack 5, Vite... Instead of chasing every new toy, it's better to decide what deserves deep focus."
wordCount: 534
---

The first week of the new year is a good time to make a technical plan. 2020 brought a lot of change: Vue 3, Angular 11, webpack 5, Vite… Instead of chasing every new thing, it's better to figure out what's worth going deep on.

## 2020 Tech Retrospective

The changes that shaped the past year the most:

**The arrival of Vite** reset expectations for the dev experience. Once you've used sub-second startup, it's hard to go back to minute-long waits. Even if production still runs on webpack, it's worth considering a move for the dev environment.

**Vue 3's Composition API** is more than just a Vue feature — together with React Hooks, it established the "reuse logic with hooks/composables" pattern, replacing the messy territory once occupied by mixins and HOCs.

**TypeScript adoption** has reached the point where not using it on a new project needs justification. In 2021 the question shifts from "should we use it" to "how do we use it well."

## 2021 Technology Tree Recommendations

### Go Deep First (Direct Impact on Your Output)

**TypeScript Advanced**

```typescript
// 能写这样的类型工具函数的人，在 2021 年稀缺
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type ExtractRouteParams<T extends string> =
  T extends `${infer _}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: string }
    : T extends `${infer _}:${infer Param}`
      ? { [K in Param]: string }
      : {};
```

**React 18 / Vue 3 Depth**
It's not about memorizing APIs, but understanding concurrent rendering, Suspense data loading, and the design motivations behind the Composition API.

**Performance engineering**
Core Web Vitals entered Google's ranking algorithm (May 2021), turning LCP/FID/CLS from "nice to have" into baseline requirements.

### Worth Exploring (Broaden Your Horizon)

**SSR / meta-frameworks**: Next.js 10, Nuxt 3 beta, SvelteKit — server-side rendering has gone from an advanced technique to a standard option.

**Testing**: Vitest (a Vite-based test runner), Playwright (cross-browser E2E), Testing Library — the testing toolchain made significant progress in 2021.

**Edge computing**: Cloudflare Workers, Vercel Edge Functions — the execution boundary of the frontend keeps expanding.

### On Hold for Now

**Deno**: although 1.0 is out, the ecosystem is still immature, and migrating from Node.js costs far more than it pays off. Wait for Deno 2.0 before revisiting.

**WebAssembly**: unless you're doing audio/video processing or 3D rendering, 2021 isn't the right time to dive in.

## Practical Recommendations

**A weekly output cadence** (fits around a day job):

- Mon/Wed: read one technical blog post and take notes
- Fri: write a small snippet to verify an idea
- Monthly: finish a small side project that applies what you learned that month

**Traps to avoid**:

- Tutorial-driven learning (Tutorial Hell): building 10 To-Do apps is worth less than contributing to one real project
- Breadth first: learning 3 frameworks at once is worse than mastering one
- Ignoring soft skills: code review and writing up technical designs are essential to technical growth in 2021

## My 2021 Focus Areas

1. **TypeScript gymnastics**: get fluent with conditional types and template literal types
2. **Performance optimization**: study Core Web Vitals systematically and give existing projects a full health check
3. **The Vite ecosystem**: follow the progress of Vite 2.0 and Vitest
4. **Reading source code**: Vue 3's reactivity system + the core of React Fiber

## Summary

The value of technology isn't in its quantity, but in its depth and application. In 2021, rather than chasing every new framework, it's better to push your current stack to its limit, while keeping an eye on new trends — knowing what they do, and when it's time to switch.
