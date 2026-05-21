---
title: "微前端架構設計思考：不只是技術選型"
date: 2021-06-07 10:05:40
tags:
  - 微前端
  - 工程化
readingTime: 2
description: "今年團隊在推進一個大型 B 端平台的微前端改造，從最初的單體 Vue 應用拆分成 6 個子應用。技術選型用了 qiankun，但真正讓我學到東西的不是接入過程，而是架構設計階段的決策。"
wordCount: 469
---

今年團隊在推進一個大型 B 端平台的微前端改造，從最初的單體 Vue 應用拆分成 6 個子應用。技術選型用了 qiankun，但真正讓我學到東西的不是接入過程，而是架構設計階段的決策。

## 什麼時候該上微前端

微前端不是銀彈。見過太多團隊為了微前端而微前端，最後反而增加了複雜度。我們判斷是否需要微前端的標準：

```
需要微前端的信號：
- 團隊 >3 個，各自獨立迭代，發佈週期不同
- 技術棧無法統一（歷史包袱）
- 需要漸進式遷移舊系統
- 子系統間需要保持統一的用户體驗

不需要微前端：
- 團隊小，能協調發布
- 模塊間邊界清晰，獨立部署也行
- 純前端路由的單體應用，用代碼分割就夠了
```

我們的情況是：3 個團隊維護 6 個子系統，發佈頻率從每週到每月不等，必須拆分。

## 應用拆分策略

一開始我們按業務域拆分，效果不好。後來總結出的經驗是按兩個維度考慮：

```javascript
// 拆分粒度參考
const splitStrategy = {
  // 維度一：團隊邊界
  teamOwnership: '每個子應用必須有明確的負責團隊',

  // 維度二：獨立性
  independence: '子應用應該能獨立開發、測試、部署',

  // 反模式：按頁面拆分
  antiPattern: '一個路由 = 一個子應用，會導致子應用過多'
}
```

最終我們按業務域 + 團隊邊界拆分：用户中心、訂單系統、數據看板、運營後台、客服工具、基礎組件。

## 共享層設計

這是最容易踩坑的地方。子應用之間有很多共享的東西：用户信息、權限數據、公共組件、工具函數。我們的方案是分層設計：

```javascript
// shared/ 是所有子應用的公共依賴層
// 使用 pnpm workspace 管理

// packages/shared-utils/src/index.ts
export { request } from './request'
export { useAuth } from './auth'
export { formatCurrency, formatDate } from './format'

// packages/shared-components/src/index.ts
export { DataTable } from './DataTable'
export { SearchForm } from './SearchForm'
export { PageContainer } from './PageContainer'

// 子應用通過 pnpm workspace 引用
// apps/order-system/package.json
{
  "dependencies": {
    "@company/shared-utils": "workspace:*",
    "@company/shared-components": "workspace:*"
  }
}
```

關鍵決策：共享層版本用 `workspace:*` 固定在最新，所有子應用統一發布，避免版本碎片化。

## 狀態通信方案

子應用之間的通信是最需要剋制的地方。我們的原則是：能不通信就不通信，必須通信走主應用：

```javascript
// 主應用：全局狀態中心
// 用 CustomEvent 實現，不引入額外依賴
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

// 子應用中使用
const store = window.__GLOBAL_STORE__
store.on('currentUser', (user) => {
  // 響應用户信息變化
  refreshPermissions(user.id)
})
```

## 小結

- 微前端的價值不在技術，在於團隊協作效率的提升
- 拆分粒度按團隊邊界而非頁面粒度
- 共享層設計決定後續維護成本，需要嚴格管控
- 狀態通信要剋制，優先通過 URL 和共享存儲同步
- 漸進式遷移比一步到位更安全