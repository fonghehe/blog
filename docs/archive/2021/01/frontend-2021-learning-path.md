---
title: "前端工程师的 2021 年学习路线：深耕而非追新"
date: 2021-01-03 14:44:50
tags:
  - Vue
  - React
  - Angular
  - Webpack
  - Vite
  - Node.js
  - TypeScript
  - 测试
readingTime: 3
description: "新年第一周，适合做一次技术规划。2020 年变化太多：Vue 3、Angular 11、webpack 5、Vite……与其追赶每一个新玩意儿，不如想清楚哪些值得深耕。"
---

新年第一周，适合做一次技术规划。2020 年变化太多：Vue 3、Angular 11、webpack 5、Vite……与其追赶每一个新玩意儿，不如想清楚哪些值得深耕。

## 2020 年技术复盘

过去一年影响最深的几个变化：

**Vite 的出现**改变了开发体验的预期。一旦用过秒级启动，很难回去接受分钟级等待。即使你的生产环境还在用 webpack，开发环境也值得考虑迁移。

**Vue 3 的 Composition API** 不只是 Vue 的特性，它和 React Hooks 共同确立了"逻辑复用用 hook/composable"的范式，替代了过去 mixin 和 HOC 的混乱地带。

**TypeScript 渗透率** 已经到了"新项目不用需要解释"的程度。2021 年关注点应该从"要不要用"转向"怎么用好"。

## 2021 年技术树推荐

### 优先深耕（直接影响工作产出）

**TypeScript 进阶**

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

**React 18 / Vue 3 深度**
不是学 API，是理解并发渲染、Suspense 数据加载、Composition API 的设计动机。

**性能工程化**
Core Web Vitals 进入 Google 排名算法（2021 年 5 月），LCP/FID/CLS 从"锦上添花"变成"基础要求"。

### 值得了解（扩宽技术视野）

**SSR / 元框架**：Next.js 10、Nuxt 3 beta、SvelteKit——服务端渲染从"高端玩法"变成了标配选项。

**测试**：Vitest（基于 Vite 的测试框架）、Playwright（跨浏览器 E2E）、Testing Library——测试工具链在 2021 年有显著进步。

**边缘计算**：Cloudflare Workers、Vercel Edge Functions——前端的执行边界在扩展。

### 暂时观望

**Deno**：虽然 1.0 已经发布，但生态仍不成熟，Node.js 生态的迁移成本远大于收益。等 Deno 2.0 再看。

**WebAssembly**：除非你在做音视频处理或 3D 渲染，否则 2021 年还不是进入的好时机。

## 实操建议

**每周输出节奏**（适合工作之余）：

- 周一/三：阅读一篇技术博客并做笔记
- 周五：写一小段验证性代码
- 每月：完成一个小 Side Project，应用当月学的东西

**避免的陷阱**：

- 教程驱动学习（Tutorial Hell）：做完 10 个 To-Do App 不如参与一个真实项目
- 广度优先：同时学 3 个框架不如把一个用到极致
- 忽视软技能：代码审查、技术方案写作，2021 年的技术成长少不了这些

## 我的 2021 重点

1. **TypeScript 体操**：把条件类型、模板字面量类型用熟
2. **性能优化**：系统学习 Core Web Vitals，给现有项目做一次全面体检
3. **Vite 生态**：跟进 Vite 2.0 和 Vitest 的进展
4. **阅读源码**：Vue 3 响应式系统 + React Fiber 核心部分

## 总结

技术的价值不在于数量，在于深度和应用。2021 年与其追赶每一个新框架，不如把当前技术栈用到极致，同时保持对新趋势的关注——知道它在做什么，以及什么时候该切换。
