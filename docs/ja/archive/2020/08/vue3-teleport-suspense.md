---
title: "Vue 3 TeleportとSuspenseコンポーネント"
date: 2020-08-03 14:49:22
tags:
  - Vue
readingTime: 6
description: "Vue 3 新增了两个内置组件：Teleport 和 Suspense。一个解决 DOM 结构嵌套问题，一个解决异步组件加载状态问题。这两个在实际项目中用得非常频繁，特别是 Teleport，几乎是模态框组件的标配了。"
wordCount: 1108
---

Vue 3 には組み込みコンポーネントとして Teleport と Suspense の 2 つが追加された。一方は DOM 構造のネスト問題を解決し、もう一方は非同期コンポーネントの読み込み状態の問題を解決する。どちらも実際のプロジェクトで非常によく使われる。とりわけ Teleport は、モーダルコンポーネントの事実上の標準になっている。

## Teleport：DOMツリーの任意の場所にコンポーネントをレンダリング

### なぜTeleportが必要なのか

モーダルや Toast、Drawer といったオーバーレイ系コンポーネントを作る際、よく次のような問題に直面する。コンポーネントの DOM 構造が親コンポーネントの中にネストされているのに、実際には body 直下に描画したい――そうしないと `overflow: hidden` や `z-index` の影響を受けてしまうのだ。

従来の解決策は、DOM を手動で操作するか、Portal ライブラリを使うかのいずれかだった。Vue 3 の Teleport はネイティブな解決策だ。

```vue
<template>
  <div class="modal-wrapper">
    <!-- 这个按钮在当前组件内 -->
    <button @click="showModal = true">打开弹窗</button>

    <!-- 弹窗 DOM 实际会被渲染到 body 下面 -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-content">
          <header>
            <h3>确认操作</h3>
            <button @click="showModal = false">&times;</button>
          </header>
          <section>
            <slot />
          </section>
          <footer>
            <button @click="showModal = false">取消</button>
            <button @click="handleConfirm">确认</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>
```

### Teleportのターゲットセレクタ

```vue
<template>
  <!-- 渲染到 body -->
  <Teleport to="body">
    <Toast message="操作成功" />
  </Teleport>

  <!-- 渲染到指定的 DOM 元素 -->
  <Teleport to="#app-portal">
    <NotificationPanel />
  </Teleport>

  <!-- 动态目标 -->
  <Teleport :to="targetSelector">
    <DynamicContent />
  </Teleport>
</template>

<script>
import { ref } from 'vue'

const targetSelector = ref('#sidebar')
// 可以动态切换目标
function moveToFooter() {
  targetSelector.value = '#footer'
}
</script>
```

### 同じターゲットへの複数のTeleport

複数の Teleport を同じターゲット要素に描画でき、宣言順に追加される：

```vue
<template>
  <!-- 第一个通知 -->
  <Teleport to="#notification-area">
    <Toast message="第一条通知" />
  </Teleport>

  <!-- 第二个通知，会追加到同一个容器中 -->
  <Teleport to="#notification-area">
    <Toast message="第二条通知" />
  </Teleport>
</template>
```

### Teleportの無効化

状況によっては Teleport を無効にしたい場合がある（たとえばユニットテスト時など）：

```vue
<template>
  <!-- disabled 时不会 Teleport，仍在原位渲染 -->
  <Teleport to="body" :disabled="isTesting">
    <Modal />
  </Teleport>
</template>
```

### 実践：グローバルToastコンポーネント

```typescript
{% raw %}
// composables/useToast.ts
import { ref, markRaw } from 'vue'

interface ToastOptions {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: number
}

const toasts = ref<ToastItem[]>([])
let idCounter = 0

export function useToast() {
  function show(options: ToastOptions) {
    const id = ++idCounter
    toasts.value.push({
      id,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration || 3000
    })

    setTimeout(() => {
      remove(id)
    }, options.duration || 3000)
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, show, remove }
}

// ToastContainer.vue
// <template>
//   <Teleport to="body">
//     <div class="toast-container">
//       <TransitionGroup name="toast">
//         <div
//           v-for="toast in toasts"
//           :key="toast.id"
//           :class="['toast', `toast--${toast.type}`]"
//         >
//           {{ toast.message }}
//           <button @click="remove(toast.id)">&times;</button>
//         </div>
//       </TransitionGroup>
//     </div>
//   </Teleport>
// </template>
{% endraw %}
```

## Suspense：非同期依存関係の処理

### 基本的な使い方

Suspense を使うと、非同期コンポーネントの読み込み状態を宣言的に扱える。子コンポーネント（またはその中の setup 関数）が Promise を返すと、Suspense はその Promise が完了するのを待つ：

```vue
<template>
  <Suspense>
    <!-- 默认插槽：异步内容 -->
    <template #default>
      <UserProfile :user-id="userId" />
    </template>

    <!-- fallback 插槽：加载中的占位 -->
    <template #fallback>
      <div class="loading-skeleton">
        <div class="skeleton-avatar" />
        <div class="skeleton-text" />
        <div class="skeleton-text skeleton-text--short" />
      </div>
    </template>
  </Suspense>
</template>
```

### async setupとの組み合わせ

```vue
{% raw %}
<!-- UserProfile.vue -->
<template>
  <div class="user-profile">
    <img :src="user.avatar" :alt="user.name" />
    <h2>{{ user.name }}</h2>
    <p>{{ user.bio }}</p>
    <div class="stats">
      <span>{{ user.followers }} 粉丝</span>
      <span>{{ user.following }} 关注</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

const props = defineProps<{ userId: string }>()

// setup 可以是 async 的，Suspense 会自动等待
const res = await fetch(`/api/users/${props.userId}`)
const user = await res.json()

// 如果 fetch 失败，错误会被 Suspense 的 error 捕获
</script>
{% endraw %}
```

### ネストされたSuspense

Suspense をネストさせると、よりきめ細かい読み込み制御が実現できる：

```vue
<template>
  <Suspense>
    <template #default>
      <div class="page">
        <!-- 先加载页面级数据 -->
        <PageHeader />

        <!-- 内层 Suspense：独立控制内容区的加载 -->
        <Suspense>
          <template #default>
            <ContentArea />
          </template>
          <template #fallback>
            <ContentSkeleton />
          </template>
        </Suspense>

        <PageFooter />
      </div>
    </template>

    <template #fallback>
      <FullPageLoader />
    </template>
  </Suspense>
</template>
```

### 配合 Teleport + Suspense

よくある場面として、モーダル内で非同期データを読み込む場合がある。Teleport が描画位置を担い、Suspense が読み込み状態を担う：

```vue
<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay">
      <div class="modal">
        <Suspense>
          <template #default>
            <OrderDetail :order-id="orderId" />
          </template>
          <template #fallback>
            <div class="modal-loading">
              <Spinner />
              <span>加载订单详情中...</span>
            </div>
          </template>
        </Suspense>
      </div>
    </div>
  </Teleport>
</template>
```

### 错误处理

Suspense には現時点で専用の error スロットはない（これは RFC でまだ議論中だ）。`onErrorCaptured` と組み合わせてエラーを処理する必要がある：

```vue
{% raw %}
<template>
  <div v-if="hasError" class="error-state">
    <p>加载失败: {{ errorMessage }}</p>
    <button @click="retry">重试</button>
  </div>
  <Suspense v-else>
    <template #default>
      <AsyncComponent :key="retryCount" />
    </template>
    <template #fallback>
      <LoadingSpinner />
    </template>
  </Suspense>
</template>

<script>
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorMessage = ref('')
const retryCount = ref(0)

onErrorCaptured((err) => {
  hasError.value = true
  errorMessage.value = err.message
  return false // 阻止错误继续传播
})

function retry() {
  hasError.value = false
  retryCount.value++ // 通过 key 变化强制重新渲染
}
</script>
{% endraw %}
```

## 注意事項

1. **Suspense は引き続き実験的（experimental）な機能だ** —— Vue 3 の正式リリース時点でも Suspense は experimental の状態にあり、API が変わる可能性があるため、本番環境での利用は慎重に
2. **Teleport でもコンポーネントインスタンスの関係は変わらない** —— DOM は別の場所に描画されても、Vue のコンポーネントツリー上の親子関係はそのままであり、provide/inject は通常通り機能する
3. **Suspense を機能させるには setup が async であるか、defineAsyncComponent を使っている必要がある** —— 普通の setup 関数では Suspense は発動しない

## まとめ

- Teleport は子コンポーネントの DOM を指定した位置に描画し、モーダルや Toast といったオーバーレイの z-index や overflow の問題を解決する
- Teleport は動的ターゲット、同一ターゲットへの複数 Teleport、および無効化モードに対応している
- Suspense は非同期コンポーネントの読み込み状態とエラー状態を宣言的に扱う
- Suspense はネストに対応しており、よりきめ細かい読み込み制御が可能になる
- Suspense は現時点でも実験的（experimental）な特性であり、本番での利用では API の変化に注意が必要だ
- Teleport と Suspense を組み合わせるのは、非同期のモーダル内容を扱ううえでのベストプラクティスだ
