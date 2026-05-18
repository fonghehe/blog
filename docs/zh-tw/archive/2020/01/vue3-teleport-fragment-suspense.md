---
title: "Vue 3 Teleport、Fragment、Suspense 新特性"
date: 2020-01-10 15:48:35
tags:
  - Vue
readingTime: 2
description: "Vue 3 引入了三個實用的內建元件：Teleport 將子節點渲染到 DOM 樹的任意位置，Fragment 支援多根節點模板，Suspense 處理非同步元件的載入態。這三個特性解決了 Vue 2 中長期存在的痛點。"
---

Vue 3 引入了三個實用的內建元件：Teleport 將子節點渲染到 DOM 樹的任意位置，Fragment 支援多根節點模板，Suspense 處理非同步元件的載入態。這三個特性解決了 Vue 2 中長期存在的痛點。

## Teleport：跳出元件層級

Modal、Tooltip、全屏 Loading 這類元件經常因為父級的 `overflow: hidden` 或 `z-index` 被遮擋。Teleport 可以將 DOM 移動到指定位置，同時保持元件的邏輯歸屬不變。

```vue
<template>
  <div>
    <button @click="showModal = true">開啟彈窗</button>
    <!-- 渲染到 body 末尾，不受父元件 CSS 影響 -->
    <teleport to="body">
      <div v-if="showModal" class="modal-overlay">
        <div class="modal-content">
          <h3>確認操作</h3>
          <p>確定要刪除這條記錄嗎？</p>
          <button @click="confirmDelete">確定</button>
          <button @click="showModal = false">取消</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  setup() {
    const showModal = ref(false)
    const confirmDelete = () => {
      console.log('已刪除')
      showModal.value = false
    }
    return { showModal, confirmDelete }
  }
}
</script>
```

關鍵點：Teleport 的 `to` 接受任何 CSS 選擇器。元件解除安裝時，Teleport 的內容也會自動移除。

## Fragment：告別多餘包裹節點

Vue 2 要求模板只有一個根節點，這導致大量無意義的 `<div>` 包裹層。Vue 3 支援多根節點。

```vue
<template>
  <!-- Vue 2 必須包裹一層 div -->
  <!-- Vue 3 可以直接多個根節點 -->
  <header>
    <nav>
      <a href="/">首頁</a>
      <a href="/about">關於</a>
    </nav>
  </header>
  <main>
    <slot />
  </main>
  <footer>
    <p>&copy; 2020 Vue Blog</p>
  </footer>
</template>

<script>
export default {
  name: 'Layout'
}
</script>
```

注意：使用多根節點時，不能通過 `$attrs` 直接透傳屬性到根元素，需要顯式繫結 `v-bind="$attrs"` 到某個具體元素上。

## Suspense：非同步元件的載入態

Suspense 可以等待巢狀的非同步依賴（非同步元件或元件內的非同步 setup）全部就緒後再渲染。

```vue
<template>
  <Suspense>
    <template #default>
      <UserProfile :userId="1" />
    </template>
    <template #fallback>
      <div class="loading-skeleton">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      </div>
    </template>
  </Suspense>
</template>

<script>
import { defineAsyncComponent } from 'vue'

const UserProfile = defineAsyncComponent({
  loader: () => import('./components/UserProfile.vue'),
  loadingComponent: {
    template: '<div>載入中...</div>'
  },
  delay: 200,
  timeout: 10000
})

export default {
  components: { UserProfile }
}
</script>
```

配合 setup 中的非同步操作，Suspense 可以等待 `setup` 函式返回 Promise。

```vue
<script>
import { ref } from 'vue'

export default {
  async setup() {
    const data = ref(null)
    // setup 返回 Promise，Suspense 會等待它完成
    const res = await fetch('/api/user/profile')
    data.value = await res.json()
    return { data }
  }
}
</script>
```

## 三個特性的組合使用

實際專案中這三個特性經常配合使用。比如一個非同步載入的全域性 Dialog：

```vue
<template>
  <Teleport to="body">
    <Suspense>
      <template #default>
        <AsyncDialog v-if="visible" @close="visible = false" />
      </template>
      <template #fallback>
        <div class="dialog-loading">載入彈窗元件中...</div>
      </template>
    </Suspense>
  </Teleport>
</template>

<script>
import { defineAsyncComponent, ref } from 'vue'

const AsyncDialog = defineAsyncComponent(() =>
  import('./HeavyDialog.vue')
)

export default {
  components: { AsyncDialog },
  props: { visible: Boolean }
}
</script>
```

## 小結

- Teleport 解決了 Modal/Tooltip 被父級 CSS 影響的經典問題，元件邏輯不移動，只移動 DOM
- Fragment 消除了無意義的包裹節點，但要注意 `$attrs` 顯式繫結
- Suspense 統一管理非同步元件和非同步 setup 的載入態，替代手動 loading 狀態
- 三個特性可以自由組合，構建更靈活的元件結構
