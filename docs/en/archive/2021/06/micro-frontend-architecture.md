---
title: "Micro Frontend Architecture Design: Beyond Technology Selection"
date: 2021-06-07 10:05:40
tags:
  - Micro Frontend
  - Engineering

readingTime: 2
description: "This year my team drove a micro-frontend transformation of a large B-side platform, splitting a monolithic Vue app into six sub-applications. We chose qiankun, but what really taught me something wasn't the integration process — it was the decisions made during architecture design."
wordCount: 299
---

This year our team undertook a micro-frontend overhaul of a large B2B platform, splitting the original monolithic Vue app into six sub-applications. We chose qiankun as the framework, but what taught me the most wasn't the integration process — it was the decisions made during the architecture-design phase.

## When to Adopt Micro Frontends

Micro frontends aren't a silver bullet. I've seen too many teams adopt them just for the sake of it, only to end up with more complexity. Here are the criteria we use to decide whether we actually need them:

```
需要微前端的信号：
- 团队 >3 个，各自独立迭代，发布周期不同
- 技术栈无法统一（历史包袱）
- 需要渐进式迁移旧系统
- 子系统间需要保持统一的用户体验

不需要微前端：
- 团队小，能协调发布
- 模块间边界清晰，独立部署也行
- 纯前端路由的单体应用，用代码分割就够了
```

Our situation: three teams maintaining six subsystems, with release cadences ranging from weekly to monthly — so a split was unavoidable.

## Application Split Strategy

We first split by business domain, but it didn't work well. What we eventually learned was to think in two dimensions:

```javascript
// 拆分粒度参考
const splitStrategy = {
  // 维度一：团队边界
  teamOwnership: '每个子应用必须有明确的负责团队',

  // 维度二：独立性
  independence: '子应用应该能独立开发、测试、部署',

  // 反模式：按页面拆分
  antiPattern: '一个路由 = 一个子应用，会导致子应用过多'
}
```

In the end we split by business domain plus team boundaries: a user center, an order system, a data dashboard, an operations admin, a support tool, and a base-component library.

## Shared Layer Design

This is where it's easiest to trip up. The sub-applications share a lot: user info, permission data, common components, utility functions. Our approach was a layered design:

```javascript
// shared/ 是所有子应用的公共依赖层
// 使用 pnpm workspace 管理

// packages/shared-utils/src/index.ts
export { request } from './request'
export { useAuth } from './auth'
export { formatCurrency, formatDate } from './format'

// packages/shared-components/src/index.ts
export { DataTable } from './DataTable'
export { SearchForm } from './SearchForm'
export { PageContainer } from './PageContainer'

// 子应用通过 pnpm workspace 引用
// apps/order-system/package.json
{
  "dependencies": {
    "@company/shared-utils": "workspace:*",
    "@company/shared-components": "workspace:*"
  }
}
```

Key decision: we pin the shared layer to the latest version with `workspace:*` and release all sub-applications together, avoiding version fragmentation.

## State Communication Solution

Communication between sub-applications is where restraint matters most. Our principle: don't communicate unless you have to, and when you must, route it through the host app:

```javascript
// 主应用：全局状态中心
// 用 CustomEvent 实现，不引入额外依赖
class GlobalStore {
  constructor() {
    this.state = {}
    this.listeners = {}
  }

  set(key, value) {
    this.state[key] = value
    window.dispatchEvent(
      new CustomEvent(`store:${key}`, { detail: value })
    )
  }

  get(key) {
    return this.state[key]
  }

  on(key, callback) {
    window.addEventListener(`store:${key}`, (e) => callback(e.detail))
    return () => window.removeEventListener(`store:${key}`, callback)
  }
}

// 子应用中使用
const store = window.__GLOBAL_STORE__
store.on('currentUser', (user) => {
  // 响应用户信息变化
  refreshPermissions(user.id)
})
```

## Summary

- The value of micro frontends isn't technical — it's the boost in team collaboration efficiency.
- Split by team boundaries, not by page.
- Shared-layer design determines future maintenance cost and needs strict governance.
- Keep inter-app communication restrained; prefer syncing via URL and shared storage.
- Incremental migration is safer than a big-bang rewrite.