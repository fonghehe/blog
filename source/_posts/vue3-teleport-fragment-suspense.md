---
title: "Vue 3 Teleport、Fragment、Suspense 新特性"
date: 2020-01-10 15:48:35
tags:
  - Vue
---

Vue 3 引入了三个实用的内置组件：Teleport 将子节点渲染到 DOM 树的任意位置，Fragment 支持多根节点模板，Suspense 处理异步组件的加载态。这三个特性解决了 Vue 2 中长期存在的痛点。

## Teleport：跳出组件层级

Modal、Tooltip、全屏 Loading 这类组件经常因为父级的 `overflow: hidden` 或 `z-index` 被遮挡。Teleport 可以将 DOM 移动到指定位置，同时保持组件的逻辑归属不变。

```vue
<template>
  <div>
    <button @click="showModal = true">打开弹窗</button>
    <!-- 渲染到 body 末尾，不受父组件 CSS 影响 -->
    <teleport to="body">
      <div v-if="showModal" class="modal-overlay">
        <div class="modal-content">
          <h3>确认操作</h3>
          <p>确定要删除这条记录吗？</p>
          <button @click="confirmDelete">确定</button>
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
      console.log('已删除')
      showModal.value = false
    }
    return { showModal, confirmDelete }
  }
}
</script>
```

关键点：Teleport 的 `to` 接受任何 CSS 选择器。组件卸载时，Teleport 的内容也会自动移除。

## Fragment：告别多余包裹节点

Vue 2 要求模板只有一个根节点，这导致大量无意义的 `<div>` 包裹层。Vue 3 支持多根节点。

```vue
<template>
  <!-- Vue 2 必须包裹一层 div -->
  <!-- Vue 3 可以直接多个根节点 -->
  <header>
    <nav>
      <a href="/">首页</a>
      <a href="/about">关于</a>
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

注意：使用多根节点时，不能通过 `$attrs` 直接透传属性到根元素，需要显式绑定 `v-bind="$attrs"` 到某个具体元素上。

## Suspense：异步组件的加载态

Suspense 可以等待嵌套的异步依赖（异步组件或组件内的异步 setup）全部就绪后再渲染。

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
    template: '<div>加载中...</div>'
  },
  delay: 200,
  timeout: 10000
})

export default {
  components: { UserProfile }
}
</script>
```

配合 setup 中的异步操作，Suspense 可以等待 `setup` 函数返回 Promise。

```vue
<script>
import { ref } from 'vue'

export default {
  async setup() {
    const data = ref(null)
    // setup 返回 Promise，Suspense 会等待它完成
    const res = await fetch('/api/user/profile')
    data.value = await res.json()
    return { data }
  }
}
</script>
```

## 三个特性的组合使用

实际项目中这三个特性经常配合使用。比如一个异步加载的全局 Dialog：

```vue
<template>
  <Teleport to="body">
    <Suspense>
      <template #default>
        <AsyncDialog v-if="visible" @close="visible = false" />
      </template>
      <template #fallback>
        <div class="dialog-loading">加载弹窗组件中...</div>
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

## 小结

- Teleport 解决了 Modal/Tooltip 被父级 CSS 影响的经典问题，组件逻辑不移动，只移动 DOM
- Fragment 消除了无意义的包裹节点，但要注意 `$attrs` 显式绑定
- Suspense 统一管理异步组件和异步 setup 的加载态，替代手动 loading 状态
- 三个特性可以自由组合，构建更灵活的组件结构
