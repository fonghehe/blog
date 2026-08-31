---
title: "Vue 3 新機能：Teleport・Fragment・Suspense"
date: 2020-01-10 15:48:35
tags:
  - Vue
readingTime: 3
description: "Vue 3 引入了三个实用的内置组件：Teleport 将子节点渲染到 DOM 树的任意位置，Fragment 支持多根节点模板，Suspense 处理异步组件的加载态。这三个特性解决了 Vue 2 中长期存在的痛点。"
wordCount: 731
---

Vue 3 は3つの実用的な組み込みコンポーネントを導入した：Teleport は子ノードを DOM ツリーの任意の位置に描画し、Fragment は複数ルートのテンプレートをサポートし、Suspense は非同期コンポーネントの読み込み状態を扱う。これら3つの特性は、Vue 2 で長年抱えていた課題を解決する。

## Teleport：コンポーネントツリーから抜け出す

Modal、Tooltip、全画面 Loading のようなコンポーネントは、親の `overflow: hidden` や `z-index` のせいで隠されがちだ。Teleport は DOM を指定位置に移動させつつ、コンポーネントの論理的な所属はそのままに保つ。

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

要点：Teleport の `to` は任意の CSS セレクターを受け取る。コンポーネントのアンマウント時には、Teleport の内容も自動的に削除される。

## Fragment：余分なラッパーノードとの別れ

Vue 2 はテンプレートに1つのルートノードしか許さず、そのため無意味な `<div>` のラップ層が大量に生まれた。Vue 3 は複数ルートノードをサポートする。

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

注意：複数ルートノードを使う場合、`$attrs` を通じて属性をルート要素に直接流し込むことはできず、特定の要素に `v-bind="$attrs"` を明示的に結びつける必要がある。

## Suspense：非同期コンポーネントの読み込み状態

Suspense は、ネストした非同期の依存（非同期コンポーネントやコンポーネント内の非同期 setup）がすべて揃ってから描画するのを待てる。

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

setup 内の非同期処理と組み合わせると、Suspense は `setup` 関数が Promise を返すのを待てる。

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

## 3つの特性の組み合わせ

実際のプロジェクトでは、これら3つの特性はよく組み合わせて使われる。たとえば非同期読み込みするグローバルな Dialog なら：

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

## まとめ

- Teleport は Modal/Tooltip が親の CSS の影響を受ける古典的な問題を解決し、コンポーネントのロジックは動かさず DOM だけを移動させる
- Fragment は無意味なラップノードをなくすが、`$attrs` の明示的な結びつけに注意
- Suspense は非同期コンポーネントと非同期 setup の読み込み状態を一元管理し、手動の loading 状態に代わる
- 3つの特性は自由に組み合わせられ、より柔軟なコンポーネント構造を作れる
