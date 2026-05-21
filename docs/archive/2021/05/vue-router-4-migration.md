---
title: "Vue Router 4 迁移实战：从 v3 到 v4"
date: 2021-05-03 09:31:43
tags:
  - Vue
readingTime: 2
description: "Vue 3 生态在 2021 年逐步成熟，Vue Router 4 也随之进入稳定期。年初我主导了一个中型后台管理系统的 Vue Router 3 → 4 迁移，踩了不少坑，总结一下核心变化和迁移策略。"
wordCount: 404
---

Vue 3 生态在 2021 年逐步成熟，Vue Router 4 也随之进入稳定期。年初我主导了一个中型后台管理系统的 Vue Router 3 → 4 迁移，踩了不少坑，总结一下核心变化和迁移策略。

## 路由定义方式的变化

Vue Router 4 最直观的变化是创建实例的 API 从构造函数变成了函数调用：

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

注意 `mode: 'history'` 被替换成了 `history` 参数，需要显式调用 `createWebHistory()`、`createWebHashHistory()` 或 `createMemoryHistory()`。

## 路由守卫的调整

`beforeRouteEnter`、`beforeRouteUpdate`、`beforeRouteLeave` 在组合式 API 中的写法有变化：

```javascript
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

export default {
  setup() {
    // 替代 beforeRouteLeave
    onBeforeRouteLeave((to, from) => {
      if (hasUnsavedChanges()) {
        return window.confirm('确定离开？未保存的数据将丢失')
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

## 踩坑记录

**1. `*` 通配路由不再支持**

Vue Router 4 移除了 `*` 通配符，改用 `/:pathMatch(.*)*`：

```javascript
// Vue Router 3
{ path: '*', component: NotFound }

// Vue Router 4
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
// 或者多级嵌套：
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
```

**2. `$router` 和 `$route` 类型变化**

在 TypeScript 项目中，需要使用 `useRouter()` 和 `useRoute()` 获取类型安全的实例：

```typescript
import { useRouter, useRoute } from 'vue-router'

export default {
  setup() {
    const router = useRouter()
    const route = useRoute()

    // route.params 有正确的类型推断
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

## 迁移策略

我们采用的是渐进式迁移：

1. 先升级 Vue Router 包，不改业务代码，利用兼容层先跑起来
2. 逐个文件替换 API，优先处理路由定义和守卫
3. 最后统一处理 TypeScript 类型问题
4. 充分测试动态路由和嵌套路由场景

整个迁移过程大约花了 2 周，主要时间花在类型修复和边界用例测试上。

## 小结

- Vue Router 4 的 API 设计更加函数化，和 Vue 3 的组合式 API 风格一致
- 通配路由、路由守卫写法变化是主要的 breaking change
- TypeScript 支持显著增强，`useRouter`/`useRoute` 是推荐方式
- 渐进式迁移策略能有效降低风险