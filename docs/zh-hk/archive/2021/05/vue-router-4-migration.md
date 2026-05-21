---
title: "Vue Router 4 遷移實戰：從 v3 到 v4"
date: 2021-05-03 09:31:43
tags:
  - Vue
readingTime: 2
description: "Vue 3 生態在 2021 年逐步成熟，Vue Router 4 也隨之進入穩定期。年初我主導了一箇中型後台管理系統的 Vue Router 3 → 4 遷移，踩了不少坑，總結一下核心變化和遷移策略。"
wordCount: 404
---

Vue 3 生態在 2021 年逐步成熟，Vue Router 4 也隨之進入穩定期。年初我主導了一箇中型後台管理系統的 Vue Router 3 → 4 遷移，踩了不少坑，總結一下核心變化和遷移策略。

## 路由定義方式的變化

Vue Router 4 最直觀的變化是創建實例的 API 從構造函數變成了函數調用：

```javascript
// Vue Router 3
import Vue from 'vue'
import VueRouter from 'vue-router'
Vue.use(VueRouter)
const router = new VueRouter({
  routes: [...]
})

// Vue Router 4
import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(),
  routes: [...]
})
```

注意 `mode: 'history'` 被替換成了 `history` 參數，需要顯式調用 `createWebHistory()`、`createWebHashHistory()` 或 `createMemoryHistory()`。

## 路由守衞的調整

`beforeRouteEnter`、`beforeRouteUpdate`、`beforeRouteLeave` 在組合式 API 中的寫法有變化：

```javascript
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

export default {
  setup() {
    // 替代 beforeRouteLeave
    onBeforeRouteLeave((to, from) => {
      if (hasUnsavedChanges()) {
        return window.confirm('確定離開？未保存的數據將丟失')
      }
    })

    // 替代 beforeRouteUpdate
    onBeforeRouteUpdate((to, from) => {
      if (to.params.id !== from.params.id) {
        fetchUserData(to.params.id)
      }
    })
  }
}
```

## 踩坑記錄

**1. `*` 通配路由不再支持**

Vue Router 4 移除了 `*` 通配符，改用 `/:pathMatch(.*)*`：

```javascript
// Vue Router 3
{ path: '*', component: NotFound }

// Vue Router 4
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
// 或者多級嵌套：
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
```

**2. `$router` 和 `$route` 類型變化**

在 TypeScript 項目中，需要使用 `useRouter()` 和 `useRoute()` 獲取類型安全的實例：

```typescript
import { useRouter, useRoute } from 'vue-router'

export default {
  setup() {
    const router = useRouter()
    const route = useRoute()

    // route.params 有正確的類型推斷
    console.log(route.params.id) // string | string[]
  }
}
```

**3. 移除了 `router.match`**

用 `router.resolve()` 替代：

```javascript
// Vue Router 3
const route = router.match('/path')

// Vue Router 4
const resolved = router.resolve('/path')
```

## 遷移策略

我們採用的是漸進式遷移：

1. 先升級 Vue Router 包，不改業務代碼，利用兼容層先跑起來
2. 逐個文件替換 API，優先處理路由定義和守衞
3. 最後統一處理 TypeScript 類型問題
4. 充分測試動態路由和嵌套路由場景

整個遷移過程大約花了 2 周，主要時間花在類型修復和邊界用例測試上。

## 小結

- Vue Router 4 的 API 設計更加函數化，和 Vue 3 的組合式 API 風格一致
- 通配路由、路由守衞寫法變化是主要的 breaking change
- TypeScript 支持顯著增強，`useRouter`/`useRoute` 是推薦方式
- 漸進式遷移策略能有效降低風險