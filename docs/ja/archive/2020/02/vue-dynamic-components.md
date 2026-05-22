---
title: "Vueの動的コンポーネントと非同期コンポーネント"
date: 2020-02-07 17:08:14
tags:
  - Vue
readingTime: 4
description: "動的コンポーネントと非同期コンポーネントは、複雑なフロントエンドアプリケーションを構築するための 2 つの強力なツールです。動的コンポーネントは実行時にどのコンポーネントをレンダリングするかを決定する問題を解決し、非同期コンポーネントはコンポーネントコードをオンデマンドで読み込む問題を解決します。両者を組み合わせることで、柔軟性の高いページアーキテクチャを実現できます。"
wordCount: 847
---

動的コンポーネントと非同期コンポーネントは、複雑なフロントエンドアプリケーションを構築するための 2 つの強力なツールです。動的コンポーネントは「実行時にどのコンポーネントをレンダリングするか」という問題を解決し、非同期コンポーネントは「コンポーネントコードをオンデマンドで読み込む」という問題を解決します。両者を組み合わせることで、高度に柔軟なページアーキテクチャを実現できます。

## componentタグの基本的な使い方

`<component :is="...">` を使用すると、データに基づいてレンダリングするコンポーネントを動的に切り替えることができます。

```vue
{% raw %}
<template>
  <div>
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        :class="{ active: currentTab === tab.name }"
        @click="currentTab = tab.name"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 動的にコンポーネントを切り替え -->
    <component :is="currentComponent" v-bind="currentProps" />
  </div>
</template>

<script>
import { ref, computed, shallowRef } from 'vue'
import TabOverview from './tabs/TabOverview.vue'
import TabSettings from './tabs/TabSettings.vue'
import TabMembers from './tabs/TabMembers.vue'

export default {
  components: { TabOverview, TabSettings, TabMembers },
  setup() {
    const currentTab = shallowRef('overview')

    const tabs = [
      { name: 'overview', label: '概览', component: 'TabOverview', props: {} },
      { name: 'settings', label: '设置', component: 'TabSettings', props: {} },
      { name: 'members', label: '成员', component: 'TabMembers', props: { teamId: 1 } }
    ]

    const currentComponent = computed(() => {
      const tab = tabs.find(t => t.name === currentTab.value)
      return tab ? tab.component : 'TabOverview'
    })

    const currentProps = computed(() => {
      const tab = tabs.find(t => t.name === currentTab.value)
      return tab ? tab.props : {}
    })

    return { tabs, currentTab, currentComponent, currentProps }
  }
}
</script>
{% endraw %}
```

ここでは `ref` ではなく `shallowRef` を使用していることに注意してください。コンポーネントオブジェクト自体は深いリアクティブ性を必要としないため、`shallowRef` を使用することでコンポーネント定義オブジェクトへの不要な Proxy ラッピングを回避でき、パフォーマンスが向上します。

## keep-aliveと組み合わせた状態キャッシュ

動的にコンポーネントを切り替えると状態が失われます。`<keep-alive>` を使用してコンポーネントインスタンスをキャッシュします。

```vue
<template>
  <div>
    <nav>
      <button @click="view = 'List'">列表</button>
      <button @click="view = 'Form'">表单</button>
      <button @click="view = 'Chart'">图表</button>
    </nav>

    <!-- 訪問済みのコンポーネントインスタンスをキャッシュ -->
    <keep-alive :include="cachedViews" :max="5">
      <component :is="view" />
    </keep-alive>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  setup() {
    const view = ref('List')

    // 指定したコンポーネントのみキャッシュ
    const cachedViews = computed(() => {
      if (view.value === 'Chart') return [] // チャートはキャッシュしない
      return ['List', 'Form']
    })

    return { view, cachedViews }
  }
}
</script>
```

`keep-alive` の `include` はコンポーネント名の配列または正規表現を受け付け、`max` は最大キャッシュ数を制限してメモリリークを防ぎます。

## 非同期コンポーネントと defineAsyncComponent

大規模なコンポーネント（リッチテキストエディタ、地図、チャートライブラリなど）は、必要なときにのみ読み込むことで、初回表示のバンドルサイズを大幅に削減できます。

```vue
<template>
  <div>
    <button @click="showMap = true">显示地图</button>

    <Suspense v-if="showMap">
      <template #default>
        <AsyncMap :center="[116.39, 39.9]" :zoom="12" />
      </template>
      <template #fallback>
        <div class="map-placeholder">地图加载中...</div>
      </template>
    </Suspense>
  </div>
</template>

<script>
import { defineAsyncComponent, ref } from 'vue'

const AsyncMap = defineAsyncComponent(() =>
  import('./components/AMap.vue')
)

export default {
  components: { AsyncMap },
  setup() {
    const showMap = ref(false)
    return { showMap }
  }
}
</script>
```

## 高度な設定：タイムアウトとエラーハンドリング

`defineAsyncComponent` は完全なロードライフサイクル制御をサポートしています。

```javascript
import { defineAsyncComponent, h } from 'vue'

const HeavyChart = defineAsyncComponent({
  loader: () => import('./components/HeavyChart.vue'),

  // カスタムローディングコンポーネント
  loadingComponent: {
    template: `
      <div class="chart-loading">
        <div class="spinner"></div>
        <p>图表渲染引擎加载中...</p>
      </div>
    `
  },

  // カスタムエラーコンポーネント
  errorComponent: {
    props: ['error'],
    setup(props) {
      return () => h('div', { class: 'chart-error' }, [
        h('p', '图表加载失败'),
        h('button', {
          onClick: () => window.location.reload()
        }, '刷新重试')
      ])
    }
  },

  delay: 200,     // 200ms 遅延して loading コンポーネントを表示
  timeout: 30000,  // 30 秒タイムアウト

  // ロード失敗時のリトライ
  onError(error, retry, fail) {
    if (error.message.includes('Network')) {
      retry() // ネットワークエラーは自動リトライ
    } else {
      fail()  // その他のエラーは直接エラーコンポーネントを表示
    }
  }
})
```

## 動的コンポーネント + 非同期コンポーネント：権限に基づくページレンダリング

管理画面では、ロールによって表示されるページモジュールが異なります。

```javascript
// utils/componentMap.js
export const componentMap = {
  'dashboard': () => import('../views/Dashboard.vue'),
  'user-manage': () => import('../views/UserManage.vue'),
  'order-manage': () => import('../views/OrderManage.vue'),
  'finance-report': () => import('../views/FinanceReport.vue'),
  'system-config': () => import('../views/SystemConfig.vue')
}

// コンポーネント内での使用
import { defineAsyncComponent, computed } from 'vue'
import { componentMap } from '../utils/componentMap'

export default {
  props: { moduleName: String },
  setup(props) {
    const currentComponent = computed(() => {
      const loader = componentMap[props.moduleName]
      if (!loader) {
        return { template: '<div>404 模块不存在</div>' }
      }
      return defineAsyncComponent(loader)
    })

    return { currentComponent }
  }
}

// <component :is="currentComponent" />
```

## まとめ

- `<component :is>` は動的レンダリングの中核であり、`shallowRef` で不要な Proxy オーバーヘッドを回避します
- `<keep-alive>` はコンポーネントインスタンスをキャッシュし、`include` と `max` でキャッシュ範囲を制御します
- `defineAsyncComponent` はコンポーネントレベルのコード分割を実現し、`Suspense` と組み合わせてローディング状態を管理します
- 本番環境では必ず `errorComponent` と `onError` を設定し、ユーザーに優しいフォールバック体験を提供しましょう
