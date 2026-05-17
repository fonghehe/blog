---
title: "Vue 3 Vapor Mode：仮想DOMなし"
date: 2023-02-02 14:50:15
tags:
  - Vue
readingTime: 3
description: "Vue 团队在 Vue 3.3+ 版本中逐渐披露了 Vapor Mode 的设计思路。Vapor Mode 是一种编译策略，将 Vue SFC 编译为直接操作 DOM 的命令式代码，跳过虚拟 DOM 的 diff 过程。这是 Vue 对 SolidJS 和 Svelte 编译时优化思路的回应。"
---

Vue 团队在 Vue 3.3+ 版本中逐渐披露了 Vapor Mode 的设计思路。Vapor Mode 是一种编译策略，将 Vue SFC 编译为直接操作 DOM 的命令式代码，跳过虚拟 DOM 的 diff 过程。这是 Vue 对 SolidJS 和 Svelte 编译时优化思路的回应。

## 仮想DOMのコスト

虚拟 DOM 为 Vue 提供了声明式编程模型和跨平台能力，但有固定开销：创建虚拟节点树、diff 算法比较、生成更新指令。

```vue
<!-- 传统模式：每次更新都走 vdom diff -->
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

<!-- 编译后的 render 函数（简化版） -->
<script>
// 每次 count 变化，整个 render 函数重新执行
// 生成新的 vnode 树，然后 diff 比较
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

即使只有 `count` 变化，也需要重新创建整棵 vnode 树并 diff。Vue 3 的静态提升（hoistStatic）和 patchFlag 可以减少 diff 工作量，但 vnode 创建的开销依然存在。

## Vapor Mode のコンパイル出力

Vapor Mode 下，Vue 编译器会分析模板中每个响应式变量的影响范围，生成直接操作 DOM 的代码。

```vue
<!-- 开发者写的代码完全一样 -->
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

<!-- Vapor Mode 编译输出（概念性伪代码） -->
<script>
import { ref, renderEffect, setElementText } from 'vue/vapor'

const title = ref('Hello')
const description = ref('World')
const count = ref(0)

// 直接创建 DOM 节点，没有虚拟 DOM
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

// 精确的副作用绑定：只有对应响应式变量变化时才更新对应 DOM
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

当 `count` 变化时，只有 `_span` 的文本节点被更新。`_h2` 和 `_p` 完全不受影响，没有 vnode 创建，没有 diff。

## リアクティブAPIへの影響

Vapor Mode 对 `reactive()` 和 `ref()` 的使用没有影响，响应式系统完全保留。区别在于模板更新的调度方式。

```vue
<script setup>
import { ref, computed, watch } from 'vue'

// 这些 API 在 Vapor Mode 中完全正常
const items = ref([
  { id: 1, text: 'Learn Vue' },
  { id: 2, text: 'Build app' },
])

const count = computed(() => items.value.length)

// watch 也正常工作
watch(items, (newVal) => {
  console.log('Items changed:', newVal.length)
}, { deep: true })

// 事件处理不变
function addItem() {
  items.value.push({ id: Date.now(), text: 'New item' })
}

function removeItem(id) {
  items.value = items.value.filter(item => item.id !== id)
}
</script>

<template>
  <!-- Vapor Mode 会为 v-for 生成高效的列表更新算法 -->
  <ul>
    <li v-for="item in items" :key="item.id">
      {{ item.text }}
      <button @click="removeItem(item.id)">删除</button>
    </li>
  </ul>
  <p>共 {{ count }} 项</p>
  <button @click="addItem">添加</button>
</template>
```

## Svelte と SolidJS との比較

Vapor Mode 的思路接近 Svelte，但有本质区别。

```ts
// Svelte：编译时确定所有更新路径，没有运行时响应式系统
// 更新是编译生成的命令式代码
let count = 0
// 编译后：直接赋值 DOM，没有响应式运行时

// SolidJS：有响应式运行时，但没有虚拟 DOM
// 通过 createSignal + JSX 实现精确更新
const [count, setCount] = createSignal(0)
// <span>{count()}</span> 编译为：直接绑定响应式到文本节点

// Vue Vapor Mode：保留 Vue 的响应式运行时 + 模板语法
// 编译输出类似 SolidJS 的直接 DOM 操作
const count = ref(0)
// <span>{{ count }}</span> 编译为：renderEffect + setElementText
```

关键区别：Vue 不会变成 Svelte 那样的纯编译框架。响应式系统依然在运行时工作，`ref`、`computed`、`watch` 都保留。Vapor Mode 只是改变了模板到 DOM 的映射方式。

## 使用制限と互換性

Vapor Mode 不是对所有 Vue 特性的全面替代。部分依赖虚拟 DOM 的特性在 Vapor Mode 中不可用。

```vue
<!-- 不支持的特性 -->
<script setup>
// 1. render 函数组件在 Vapor Mode 中不可用
// 需要回退到 vdom 模式
import { h } from 'vue'

const RenderFnComponent = (props) => {
  return h('div', null, props.text) // Vapor 不支持
}

// 2. <Transition>、<KeepAlive> 等依赖 vdom 的内置组件
// 需要特殊处理或回退

// 3. 动态组件 :is 在某些复杂场景下可能回退到 vdom
</script>

<template>
  <!-- 支持：绝大多数模板语法 -->
  <div v-if="show">条件渲染</div>
  <div v-for="item in items" :key="item.id">列表</div>
  <input v-model="text" />

  <!-- 可能回退：复杂的动态组件 -->
  <component :is="currentComponent" />
</template>
```

## まとめ

- Vapor Mode 将 Vue SFC 编译为直接操作 DOM 的代码，跳过虚拟 DOM diff
- 响应式系统完全保留，`ref`、`computed`、`watch` 等 API 不受影响
- 性能收益来自省略 vnode 创建和 diff，更新精确到单个文本节点/属性
- 开发体验不变，只需在 `<script setup>` 中添加 `vapor` 标记即可启用
- 部分依赖虚拟 DOM 的特性（render 函数、Transition 等）在 Vapor Mode 中有限制