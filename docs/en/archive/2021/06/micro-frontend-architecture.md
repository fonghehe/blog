---
title: "Micro Frontend Architecture Design: Beyond Technology Selection"
date: 2021-06-07 10:05:40
tags:
  - Micro Frontend
  - Engineering

readingTime: 2
description: "今年团队在推进一个大型 B 端平台的微前端改造，从最初的单体 Vue 应用拆分成 6 个子应用。技术选型用了 qiankun，但真正让我学到东西的不是接入过程，而是架构设计阶段的决策。"
---

今年团队在推进一个大型 B 端平台的微前端改造，从最初的单体 Vue 应用拆分成 6 个子应用。技术选型用了 qiankun，但真正让我学到东西的不是接入过程，而是架构设计阶段的决策。

## When to Adopt Micro Frontends

微前端不是银弹。见过太多团队为了微前端而微前端，最后反而增加了复杂度。我们判断是否需要微前端的标准：

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

我们的情况是：3 个团队维护 6 个子系统，发布频率从每周到每月不等，必须拆分。

## Application Split Strategy

一开始我们按业务域拆分，效果不好。后来总结出的经验是按两个维度考虑：

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

最终我们按业务域 + 团队边界拆分：用户中心、订单系统、数据看板、运营后台、客服工具、基础组件。

## Shared Layer Design

这是最容易踩坑的地方。子应用之间有很多共享的东西：用户信息、权限数据、公共组件、工具函数。我们的方案是分层设计：

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

关键决策：共享层版本用 `workspace:*` 固定在最新，所有子应用统一发布，避免版本碎片化。

## State Communication Solution

子应用之间的通信是最需要克制的地方。我们的原则是：能不通信就不通信，必须通信走主应用：

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

- 微前端的价值不在技术，在于团队协作效率的提升
- 拆分粒度按团队边界而非页面粒度
- 共享层设计决定后续维护成本，需要严格管控
- 状态通信要克制，优先通过 URL 和共享存储同步
- 渐进式迁移比一步到位更安全