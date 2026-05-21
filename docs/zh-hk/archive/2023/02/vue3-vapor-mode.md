---
title: "Vue 3 Vapor Mode 無虛擬 DOM"
date: 2023-02-02 14:50:15
tags:
  - Vue
readingTime: 3
description: "Vue 團隊在 Vue 3.3+ 版本中逐漸披露了 Vapor Mode 的設計思路。Vapor Mode 是一種編譯策略，將 Vue SFC 編譯為直接操作 DOM 的命令式代碼，跳過虛擬 DOM 的 diff 過程。這是 Vue 對 SolidJS 和 Svelte 編譯時優化思路的回應。"
wordCount: 531
---

Vue 團隊在 Vue 3.3+ 版本中逐漸披露了 Vapor Mode 的設計思路。Vapor Mode 是一種編譯策略，將 Vue SFC 編譯為直接操作 DOM 的命令式代碼，跳過虛擬 DOM 的 diff 過程。這是 Vue 對 SolidJS 和 Svelte 編譯時優化思路的回應。

## 虛擬 DOM 的成本

虛擬 DOM 為 Vue 提供了聲明式編程模型和跨平台能力，但有固定開銷：創建虛擬節點樹、diff 算法比較、生成更新指令。

```vue
<!-- 傳統模式：每次更新都走 vdom diff -->
<template>
  <div class="card">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <span>Count: {{ count }}</span>
    <button @click="count++">+1</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const title = ref('Hello')
const description = ref('World')
const count = ref(0)
</script>

<!-- 編譯後的 render 函數（簡化版） -->
<script>
// 每次 count 變化，整個 render 函數重新執行
// 生成新的 vnode 樹，然後 diff 比較
function render(_ctx) {
  return h('div', { class: 'card' }, [
    h('h2', null, _ctx.title),
    h('p', null, _ctx.description),
    h('span', null, 'Count: ' + _ctx.count),
    h('button', { onClick: () => _ctx.count++ }, '+1'),
  ])
}
</script>
```

即使只有 `count` 變化，也需要重新創建整棵 vnode 樹並 diff。Vue 3 的靜態提升（hoistStatic）和 patchFlag 可以減少 diff 工作量，但 vnode 創建的開銷依然存在。

## Vapor Mode 的編譯輸出

Vapor Mode 下，Vue 編譯器會分析模板中每個響應式變量的影響範圍，生成直接操作 DOM 的代碼。

```vue
<!-- 開發者寫的代碼完全一樣 -->
<template>
  <div class="card">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <span>Count: {{ count }}</span>
    <button @click="count++">+1</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const title = ref('Hello')
const description = ref('World')
const count = ref(0)
</script>

<!-- Vapor Mode 編譯輸出（概念性偽代碼） -->
<script>
import { ref, renderEffect, setElementText } from 'vue/vapor'

const title = ref('Hello')
const description = ref('World')
const count = ref(0)

// 直接創建 DOM 節點，沒有虛擬 DOM
const _div = document.createElement('div')
_div.className = 'card'

const _h2 = document.createElement('h2')
_div.appendChild(_h2)

const _p = document.createElement('p')
_div.appendChild(_p)

const _span = document.createElement('span')
_div.appendChild(_span)

const _button = document.createElement('button')
_button.textContent = '+1'
_button.addEventListener('click', () => count.value++)
_div.appendChild(_button)

// 精確的副作用綁定：只有對應響應式變量變化時才更新對應 DOM
renderEffect(() => {
  setElementText(_h2, title.value)
})

renderEffect(() => {
  setElementText(_p, description.value)
})

renderEffect(() => {
  setElementText(_span, 'Count: ' + count.value)
})
</script>
```

當 `count` 變化時，只有 `_span` 的文本節點被更新。`_h2` 和 `_p` 完全不受影響，沒有 vnode 創建，沒有 diff。

## 對響應式 API 的影響

Vapor Mode 對 `reactive()` 和 `ref()` 的使用沒有影響，響應式系統完全保留。區別在於模板更新的調度方式。

```vue
<script setup>
import { ref, computed, watch } from 'vue'

// 這些 API 在 Vapor Mode 中完全正常
const items = ref([
  { id: 1, text: 'Learn Vue' },
  { id: 2, text: 'Build app' },
])

const count = computed(() => items.value.length)

// watch 也正常工作
watch(items, (newVal) => {
  console.log('Items changed:', newVal.length)
}, { deep: true })

// 事件處理不變
function addItem() {
  items.value.push({ id: Date.now(), text: 'New item' })
}

function removeItem(id) {
  items.value = items.value.filter(item => item.id !== id)
}
</script>

<template>
  <!-- Vapor Mode 會為 v-for 生成高效的列表更新算法 -->
  <ul>
    <li v-for="item in items" :key="item.id">
      {{ item.text }}
      <button @click="removeItem(item.id)">刪除</button>
    </li>
  </ul>
  <p>共 {{ count }} 項</p>
  <button @click="addItem">添加</button>
</template>
```

## 與 Svelte 和 SolidJS 的對比

Vapor Mode 的思路接近 Svelte，但有本質區別。

```ts
// Svelte：編譯時確定所有更新路徑，沒有運行時響應式系統
// 更新是編譯生成的命令式代碼
let count = 0
// 編譯後：直接賦值 DOM，沒有響應式運行時

// SolidJS：有響應式運行時，但沒有虛擬 DOM
// 通過 createSignal + JSX 實現精確更新
const [count, setCount] = createSignal(0)
// <span>{count()}</span> 編譯為：直接綁定響應式到文本節點

// Vue Vapor Mode：保留 Vue 的響應式運行時 + 模板語法
// 編譯輸出類似 SolidJS 的直接 DOM 操作
const count = ref(0)
// <span>{{ count }}</span> 編譯為：renderEffect + setElementText
```

關鍵區別：Vue 不會變成 Svelte 那樣的純編譯框架。響應式系統依然在運行時工作，`ref`、`computed`、`watch` 都保留。Vapor Mode 只是改變了模板到 DOM 的映射方式。

## 使用限制與兼容性

Vapor Mode 不是對所有 Vue 特性的全面替代。部分依賴虛擬 DOM 的特性在 Vapor Mode 中不可用。

```vue
<!-- 不支持的特性 -->
<script setup>
// 1. render 函數組件在 Vapor Mode 中不可用
// 需要回退到 vdom 模式
import { h } from 'vue'

const RenderFnComponent = (props) => {
  return h('div', null, props.text) // Vapor 不支持
}

// 2. <Transition>、<KeepAlive> 等依賴 vdom 的內置組件
// 需要特殊處理或回退

// 3. 動態組件 :is 在某些複雜場景下可能回退到 vdom
</script>

<template>
  <!-- 支持：絕大多數模板語法 -->
  <div v-if="show">條件渲染</div>
  <div v-for="item in items" :key="item.id">列表</div>
  <input v-model="text" />

  <!-- 可能回退：複雜的動態組件 -->
  <component :is="currentComponent" />
</template>
```

## 小結

- Vapor Mode 將 Vue SFC 編譯為直接操作 DOM 的代碼，跳過虛擬 DOM diff
- 響應式系統完全保留，`ref`、`computed`、`watch` 等 API 不受影響
- 性能收益來自省略 vnode 創建和 diff，更新精確到單個文本節點/屬性
- 開發體驗不變，只需在 `<script setup>` 中添加 `vapor` 標記即可啓用
- 部分依賴虛擬 DOM 的特性（render 函數、Transition 等）在 Vapor Mode 中有限制