---
title: "Vueコンポーネントの遅延読み込み戦略"
date: 2020-02-03 15:25:31
tags:
  - Vue
readingTime: 4
description: "初回画面の読み込みパフォーマンスは、フロントエンド最適化における主要な指標の 1 つです。Vue プロジェクトにおけるルートレベルの遅延読み込みは一般的ですが、コンポーネントレベルの遅延読み込み、画像の遅延読み込み、データの遅延読み込みといったより細かい戦略も同様に習得する価値があります。この記事ではエンジニアリングの実践から、完全な遅延読み込みソリューションをまとめます。"
wordCount: 733
---

初回画面の読み込みパフォーマンスは、フロントエンド最適化における主要な指標の 1 つです。Vue プロジェクトにおけるルートレベルの遅延読み込みは一般的ですが、コンポーネントレベルの遅延読み込み、画像の遅延読み込み、データの遅延読み込みといったより細かい戦略も同様に習得する価値があります。この記事ではエンジニアリングの実践から、完全な遅延読み込みソリューションをまとめます。

## ルートの遅延読み込み

最も基本的で効果的な最適化手段であり、ルートコンポーネントを独立したチャンクに分割します。

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    // 直接インポート、初回表示コンポーネントは遅延読み込みしない
    component: () => import('../views/Home.vue')
  },
  {
    path: '/dashboard',
    // 非同期コンポーネント、オンデマンド読み込み
    component: () => import(
      /* webpackChunkName: "dashboard" */
      '../views/Dashboard.vue'
    )
  },
  {
    path: '/settings',
    component: () => import(
      /* webpackChunkName: "settings" */
      '../views/Settings.vue'
    )
  },
  {
    path: '/profile/:id',
    component: () => import(
      /* webpackChunkName: "profile" */
      '../views/Profile.vue'
    )
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

`webpackChunkName` コメントにより、バンドル成果物に読みやすいファイル名が付与され、デバッグやキャッシュ管理が容易になります。

## コンポーネントレベルの遅延読み込み

すべてのコンポーネントが初回表示時に必要とは限りません。モーダル、ドロワー、エディタなど「必要に応じて表示される」コンポーネントには、`defineAsyncComponent` を使用して遅延読み込みを実装できます。

```vue
<template>
  <div>
    <button @click="showEditor = true">打开富文本编辑器</button>

    <AsyncEditor
      v-if="showEditor"
      v-model="content"
      @close="showEditor = false"
    />
  </div>
</template>

<script>
import { defineAsyncComponent, ref } from 'vue'

// v-if が true の場合のみコンポーネントコードを読み込む
const AsyncEditor = defineAsyncComponent({
  loader: () => import('./components/HeavyEditor.vue'),
  loadingComponent: {
    template: '<div class="editor-loading">编辑器加载中...</div>'
  },
  errorComponent: {
    template: '<div class="editor-error">加载失败，请刷新重试</div>'
  },
  delay: 100,       // loading コンポーネントを表示するまでの遅延時間
  timeout: 15000,    // タイムアウト時間
  suspensible: false // Suspense に管理させない
})

export default {
  components: { AsyncEditor },
  setup() {
    const showEditor = ref(false)
    const content = ref('')
    return { showEditor, content }
  }
}
</script>
```

## Intersection Observer による画像の遅延読み込み

画像は最も一般的な帯域幅の負荷要因です。`IntersectionObserver` API を使用して、表示領域に入ったときにのみ実際の画像を読み込みます。

```javascript
// directives/v-lazy.js
export default {
  mounted(el, binding) {
    const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

    el.src = placeholder
    el.dataset.src = binding.value

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target
            img.src = img.dataset.src
            img.onload = () => {
              img.classList.add('loaded')
            }
            img.onerror = () => {
              img.src = binding.value.fallback || placeholder
            }
            observer.unobserve(img)
          }
        })
      },
      {
        rootMargin: '100px' // 100px 早めて読み込み開始
      }
    )

    observer.observe(el)
    el._lazyObserver = observer
  },

  unmounted(el) {
    if (el._lazyObserver) {
      el._lazyObserver.disconnect()
    }
  }
}

// 登録と使用
// app.directive('lazy', vLazy)
// <img v-lazy="imageUrl" alt="商品画像" />
```

## データの遅延読み込み：仮想スクロール

リストのデータ量が多い場合（1000 件以上）、表示領域の DOM のみをレンダリングするだけでパフォーマンスを大幅に向上できます。

```vue
{% raw %}
<template>
  <div
    ref="container"
    class="virtual-list"
    @scroll="onScroll"
  >
    <div class="phantom" :style="{ height: totalHeight + 'px' }"></div>
    <div
      class="content"
      :style="{ transform: `translateY(${offset}px)` }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="list-item"
        :style="{ height: itemHeight + 'px' }"
      >
        {{ item.name }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  props: {
    items: { type: Array, default: () => [] },
    itemHeight: { type: Number, default: 50 }
  },
  setup(props) {
    const container = ref(null)
    const scrollTop = ref(0)
    const visibleCount = ref(10)

    const totalHeight = computed(() => props.items.length * props.itemHeight)
    const startIndex = computed(() => Math.floor(scrollTop.value / props.itemHeight))
    const endIndex = computed(() => Math.min(startIndex.value + visibleCount.value, props.items.length))

    const visibleItems = computed(() =>
      props.items.slice(startIndex.value, endIndex.value)
    )

    const offset = computed(() => startIndex.value * props.itemHeight)

    const onScroll = (e) => {
      scrollTop.value = e.target.scrollTop
    }

    onMounted(() => {
      visibleCount.value = Math.ceil(
        container.value.clientHeight / props.itemHeight
      ) + 2
    })

    return { container, totalHeight, visibleItems, offset, onScroll }
  }
}
</script>
{% endraw %}
```

## まとめ

- ルートの遅延読み込みは `() => import()` と `webpackChunkName` を組み合わせることで、すぐに効果が現れます
- `defineAsyncComponent` はカスタム loading/error コンポーネントとタイムアウト設定をサポートしています
- 画像の遅延読み込みには IntersectionObserver を使用し、`rootMargin` を設定して事前読み込みを行います
- 大量リストには仮想スクロールを使用し、表示領域内の DOM のみをレンダリングすることで、パフォーマンスが数十倍向上する可能性があります
- 遅延読み込みの基本原則：初回表示に不要なコードとリソースは、すべてオンデマンドで読み込む
