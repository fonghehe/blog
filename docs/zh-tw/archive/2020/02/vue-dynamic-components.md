---
title: "Vue 動態元件與非同步元件"
date: 2020-02-07 17:08:14
tags:
  - Vue
readingTime: 3
description: "動態元件和非同步元件是構建複雜前端應用的兩把利器。動態元件解決\"執行時決定渲染哪個元件\"的問題，非同步元件解決\"按需載入元件程式碼\"的問題。兩者結合使用，可以實現高度靈活的頁面架構。"
---

動態元件和非同步元件是構建複雜前端應用的兩把利器。動態元件解決"執行時決定渲染哪個元件"的問題，非同步元件解決"按需載入元件程式碼"的問題。兩者結合使用，可以實現高度靈活的頁面架構。

## component 標籤基礎用法

`<component :is="...">` 允許根據資料動態切換渲染的元件。

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

    <!-- 動態切換元件 -->
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
      { name: 'overview', label: '概覽', component: 'TabOverview', props: {} },
      { name: 'settings', label: '設定', component: 'TabSettings', props: {} },
      { name: 'members', label: '成員', component: 'TabMembers', props: { teamId: 1 } }
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

注意這裡用 `shallowRef` 而非 `ref`。元件物件本身不需要深度響應式，用 `shallowRef` 可以避免對元件定義物件做不必要的 Proxy 包裹，效能更好。

## 結合 keep-alive 快取狀態

動態切換元件會導致狀態丟失。用 `<keep-alive>` 快取元件例項。

```vue
<template>
  <div>
    <nav>
      <button @click="view = 'List'">列表</button>
      <button @click="view = 'Form'">表單</button>
      <button @click="view = 'Chart'">圖表</button>
    </nav>

    <!-- 快取已訪問過的元件例項 -->
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

    // 只快取指定元件
    const cachedViews = computed(() => {
      if (view.value === 'Chart') return [] // 圖表不快取
      return ['List', 'Form']
    })

    return { view, cachedViews }
  }
}
</script>
```

`keep-alive` 的 `include` 接受元件名稱陣列或正則，`max` 限制最大快取數量，防止記憶體洩漏。

## 非同步元件與 defineAsyncComponent

對於大型元件（富文本編輯器、地圖、圖表庫），只在需要時載入可以顯著減小首屏 bundle。

```vue
<template>
  <div>
    <button @click="showMap = true">顯示地圖</button>

    <Suspense v-if="showMap">
      <template #default>
        <AsyncMap :center="[116.39, 39.9]" :zoom="12" />
      </template>
      <template #fallback>
        <div class="map-placeholder">地圖載入中...</div>
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

## 高階配置：超時與錯誤處理

`defineAsyncComponent` 支援完整的載入生命週期控制。

```javascript
import { defineAsyncComponent, h } from 'vue'

const HeavyChart = defineAsyncComponent({
  loader: () => import('./components/HeavyChart.vue'),

  // 自定義載入中元件
  loadingComponent: {
    template: `
      <div class="chart-loading">
        <div class="spinner"></div>
        <p>圖表渲染引擎載入中...</p>
      </div>
    `
  },

  // 自定義出錯元件
  errorComponent: {
    props: ['error'],
    setup(props) {
      return () => h('div', { class: 'chart-error' }, [
        h('p', '圖表載入失敗'),
        h('button', {
          onClick: () => window.location.reload()
        }, '重新整理重試')
      ])
    }
  },

  delay: 200,     // 延遲 200ms 再顯示 loading 元件
  timeout: 30000,  // 30 秒超時

  // 載入失敗重試
  onError(error, retry, fail) {
    if (error.message.includes('Network')) {
      retry() // 網路錯誤自動重試
    } else {
      fail()  // 其他錯誤直接顯示錯誤元件
    }
  }
})
```

## 動態元件 + 非同步元件：許可權驅動的頁面渲染

在後臺管理系統中，不同角色看到的頁面模組不同。

```javascript
// utils/componentMap.js
export const componentMap = {
  'dashboard': () => import('../views/Dashboard.vue'),
  'user-manage': () => import('../views/UserManage.vue'),
  'order-manage': () => import('../views/OrderManage.vue'),
  'finance-report': () => import('../views/FinanceReport.vue'),
  'system-config': () => import('../views/SystemConfig.vue')
}

// 元件中使用
import { defineAsyncComponent, computed } from 'vue'
import { componentMap } from '../utils/componentMap'

export default {
  props: { moduleName: String },
  setup(props) {
    const currentComponent = computed(() => {
      const loader = componentMap[props.moduleName]
      if (!loader) {
        return { template: '<div>404 模組不存在</div>' }
      }
      return defineAsyncComponent(loader)
    })

    return { currentComponent }
  }
}

// <component :is="currentComponent" />
```

## 小結

- `<component :is>` 是動態渲染的核心，`shallowRef` 避免不必要的 Proxy 開銷
- `<keep-alive>` 快取元件例項，`include` 和 `max` 控制快取範圍
- `defineAsyncComponent` 實現元件級程式碼拆分，配合 `Suspense` 管理載入態
- 生產環境中務必配置 `errorComponent` 和 `onError`，給使用者優雅的降級體驗
