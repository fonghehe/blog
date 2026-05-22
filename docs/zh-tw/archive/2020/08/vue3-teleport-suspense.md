---
title: "Vue 3 Teleport 與 Suspense 元件"
date: 2020-08-03 14:49:22
tags:
  - Vue
readingTime: 4
description: "Vue 3 新增了兩個內建元件：Teleport 和 Suspense。一個解決 DOM 結構巢狀問題，一個解決非同步元件載入狀態問題。這兩個在實際專案中用得非常頻繁，特別是 Teleport，幾乎是模態框元件的標配了。"
wordCount: 651
---

Vue 3 新增了兩個內建元件：Teleport 和 Suspense。一個解決 DOM 結構巢狀問題，一個解決非同步元件載入狀態問題。這兩個在實際專案中用得非常頻繁，特別是 Teleport，幾乎是模態框元件的標配了。

## Teleport：把元件渲染到 DOM 樹的任意位置

### 為什麼需要 Teleport

做彈窗、Toast、Drawer 這類浮層元件時，我們經常遇到一個問題：元件的 DOM 結構巢狀在父元件裡，但我們需要它渲染到 body 下面，否則會被 `overflow: hidden` 或 `z-index` 影響。

以前的解決方案是：手動操作 DOM，或者用 Portal 庫。Vue 3 的 Teleport 是原生方案。

```vue
<template>
  <div class="modal-wrapper">
    <!-- 這個按鈕在當前元件內 -->
    <button @click="showModal = true">開啟彈窗</button>

    <!-- 彈窗 DOM 實際會被渲染到 body 下面 -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-content">
          <header>
            <h3>確認操作</h3>
            <button @click="showModal = false">&times;</button>
          </header>
          <section>
            <slot />
          </section>
          <footer>
            <button @click="showModal = false">取消</button>
            <button @click="handleConfirm">確認</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>
```

### Teleport 的目標選擇器

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

  <!-- 動態目標 -->
  <Teleport :to="targetSelector">
    <DynamicContent />
  </Teleport>
</template>

<script>
import { ref } from 'vue'

const targetSelector = ref('#sidebar')
// 可以動態切換目標
function moveToFooter() {
  targetSelector.value = '#footer'
}
</script>
```

### 多個 Teleport 到同一目標

多個 Teleport 可以渲染到同一個目標元素，它們按宣告順序追加：

```vue
<template>
  <!-- 第一個通知 -->
  <Teleport to="#notification-area">
    <Toast message="第一條通知" />
  </Teleport>

  <!-- 第二個通知，會追加到同一個容器中 -->
  <Teleport to="#notification-area">
    <Toast message="第二條通知" />
  </Teleport>
</template>
```

### 停用 Teleport

有時候在某些條件下需要停用 Teleport（比如單元測試時）：

```vue
<template>
  <!-- disabled 時不會 Teleport，仍在原位渲染 -->
  <Teleport to="body" :disabled="isTesting">
    <Modal />
  </Teleport>
</template>
```

### 實戰：全域性 Toast 元件

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

## Suspense：處理非同步依賴

### 基本用法

Suspense 讓我們可以宣告式地處理非同步元件的載入狀態。當子元件（或子元件內的 setup 函式）返回 Promise 時，Suspense 會等待 Promise 完成：

```vue
<template>
  <Suspense>
    <!-- 預設插槽：非同步內容 -->
    <template #default>
      <UserProfile :user-id="userId" />
    </template>

    <!-- fallback 插槽：載入中的佔位 -->
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

### 配合 async setup 使用

```vue
{% raw %}
<!-- UserProfile.vue -->
<template>
  <div class="user-profile">
    <img :src="user.avatar" :alt="user.name" />
    <h2>{{ user.name }}</h2>
    <p>{{ user.bio }}</p>
    <div class="stats">
      <span>{{ user.followers }} 粉絲</span>
      <span>{{ user.following }} 關注</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

const props = defineProps<{ userId: string }>()

// setup 可以是 async 的，Suspense 會自動等待
const res = await fetch(`/api/users/${props.userId}`)
const user = await res.json()

// 如果 fetch 失敗，錯誤會被 Suspense 的 error 捕獲
</script>
{% endraw %}
```

### 巢狀 Suspense

可以巢狀 Suspense 實現更細粒度的載入控製：

```vue
<template>
  <Suspense>
    <template #default>
      <div class="page">
        <!-- 先載入頁面級資料 -->
        <PageHeader />

        <!-- 內層 Suspense：獨立控製內容區的載入 -->
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

一個常見的場景：彈窗內有非同步資料載入。Teleport 負責渲染位置，Suspense 負責載入狀態：

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
              <span>載入訂單詳情中...</span>
            </div>
          </template>
        </Suspense>
      </div>
    </div>
  </Teleport>
</template>
```

### 錯誤處理

Suspense 目前沒有專門的 error 插槽（這還在 RFC 討論中），需要配合 `onErrorCaptured` 處理錯誤：

```vue
{% raw %}
<template>
  <div v-if="hasError" class="error-state">
    <p>載入失敗: {{ errorMessage }}</p>
    <button @click="retry">重試</button>
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
  return false // 阻止錯誤繼續傳播
})

function retry() {
  hasError.value = false
  retryCount.value++ // 通過 key 變化強製重新渲染
}
</script>
{% endraw %}
```

## 注意事項

1. **Suspense 仍然是實驗性特性** —— Vue 3 正式釋出時 Suspense 還是 experimental 狀態，API 可能會變，生產環境慎用
2. **Teleport 的元件例項關係不變** —— 雖然 DOM 渲染到了別處，但 Vue 元件樹中的父子關係不變，provide/inject 照常工作
3. **Suspense 要求 setup 是 async 的或使用了 defineAsyncComponent** —— 普通的 setup 函式不會觸發 Suspense

## 小結

- Teleport 將子元件的 DOM 渲染到指定位置，解決模態框/Toast 等浮層的 z-index 和 overflow 問題
- Teleport 支援動態目標、多個 Teleport 到同一目標、以及停用模式
- Suspense 宣告式處理非同步元件的載入和錯誤狀態
- Suspense 支援巢狀，可以實現更細粒度的載入控製
- Suspense 目前仍是實驗性特性，生產使用要關注 API 變化
- Teleport + Suspense 組合是處理非同步彈窗內容的最佳實踐
