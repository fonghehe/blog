---
title: "Vue Router 4 移行実践：v3 から v4 へ"
date: 2021-05-03 09:31:43
tags:
  - Vue

readingTime: 3
description: "Vue 3 生态在 2021 年逐步成熟，Vue Router 4 也随之进入稳定期。年初我主导了一个中型后台管理系统的 Vue Router 3 → 4 迁移，踩了不少坑，总结一下核心变化和迁移策略。"
wordCount: 644
---

Vue 3 のエコシステムは 2021 年に徐々に成熟し、Vue Router 4 も安定版の段階に入った。年初に、中規模の管理画面システムの Vue Router 3 → 4 への移行を主導し、いくつものつまずきを経験したので、核心的な変化と移行の戦略をまとめておく。

## ルート定義方法の変更

Vue Router 4 で最も直感的な変化は、インスタンスを作る API がコンストラクタ呼び出しから関数呼び出しになったことだ：

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

`mode: 'history'` が `history` 引数に置き換わる点に注意し、`createWebHistory()`、`createWebHashHistory()`、`createMemoryHistory()` のいずれかを明示的に呼ぶ必要がある。

## ルートガードの調整

`beforeRouteEnter`、`beforeRouteUpdate`、`beforeRouteLeave` のコンポジション API での書き方が変化している：

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

## よくある落とし穴

**1. `*` ワイルドカードルートはサポートされなくなった**

Vue Router 4 は `*` ワイルドカードを削除し、代わりに `/:pathMatch(.*)*` を使う：

```javascript
// Vue Router 3
{ path: '*', component: NotFound }

// Vue Router 4
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
// 或者多级嵌套：
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
```

**2. `$router` 和 `$route` 类型变化**

TypeScript プロジェクトでは、型安全なインスタンスを得るために `useRouter()` と `useRoute()` を使う：

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

`router.resolve()` で代用する：

```javascript
// Vue Router 3
const route = router.match('/path')

// Vue Router 4
const resolved = router.resolve('/path')
```

## 移行戦略

我々が採用したのは段階的な移行だ：

1. まず Vue Router パッケージをアップグレードし、ビジネスコードは変更せず、互換レイヤーを使って動かす
2. ファイルごとに API を置き換え、ルート定義とガードを優先的に処理する
3. 最後に TypeScript の型の問題をまとめて処理する
4. 動的ルートとネストしたルートの場面を十分にテストする

移行全体のプロセスには約 2 週間かかり、主な時間は型の修正と境界ケースのテストに費やした。

## まとめ

- Vue Router 4 の API 設計はより関数指向になり、Vue 3 のコンポジション API のスタイルと一致している
- ワイルドカードルートやルートガードの書き方の変化が、主な breaking change だ
- TypeScript のサポートが顕著に強化され、`useRouter`/`useRoute` が推奨される手段だ
- 段階的な移行戦略はリスクを効果的に下げられる