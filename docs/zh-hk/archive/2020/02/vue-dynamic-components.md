---
title: "Vue 動態組件與異步組件"
date: 2020-02-07 17:08:14
tags:
  - Vue
readingTime: 3
description: "動態組件和異步組件是構建複雜前端應用的兩把利器。動態組件解決\"運行時決定渲染哪個組件\"的問題，異步組件解決\"按需加載組件代碼\"的問題。兩者結合使用，可以實現高度靈活的頁面架構。"
---

動態組件和異步組件是構建複雜前端應用的兩把利器。動態組件解決"運行時決定渲染哪個組件"的問題，異步組件解決"按需加載組件代碼"的問題。兩者結合使用，可以實現高度靈活的頁面架構。

## component 標籤基礎用法

`<component :is="...">` 允許根據數據動態切換渲染的組件。

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

    <!-- 動態切換組件 -->
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
      { name: 'settings', label: '設置', component: 'TabSettings', props: {} },
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

注意這裏用 `shallowRef` 而非 `ref`。組件對象本身不需要深度響應式，用 `shallowRef` 可以避免對組件定義對象做不必要的 Proxy 包裹，性能更好。

## 結合 keep-alive 緩存狀態

動態切換組件會導致狀態丟失。用 `<keep-alive>` 緩存組件實例。

```vue
<template>
  <div>
    <nav>
      <button @click="view = 'List'">列表</button>
      <button @click="view = 'Form'">表單</button>
      <button @click="view = 'Chart'">圖表</button>
    </nav>

    <!-- 緩存已訪問過的組件實例 -->
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

    // 只緩存指定組件
    const cachedViews = computed(() => {
      if (view.value === 'Chart') return [] // 圖表不緩存
      return ['List', 'Form']
    })

    return { view, cachedViews }
  }
}
</script>
```

`keep-alive` 的 `include` 接受組件名稱數組或正則，`max` 限制最大緩存數量，防止內存泄漏。

## 異步組件與 defineAsyncComponent

對於大型組件（富文本編輯器、地圖、圖表庫），只在需要時加載可以顯著減小首屏 bundle。

```vue
<template>
  <div>
    <button @click="showMap = true">顯示地圖</button>

    <Suspense v-if="showMap">
      <template #default>
        <AsyncMap :center="[116.39, 39.9]" :zoom="12" />
      </template>
      <template #fallback>
        <div class="map-placeholder">地圖加載中...</div>
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

## 高級配置：超時與錯誤處理

`defineAsyncComponent` 支持完整的加載生命週期控制。

```javascript
import { defineAsyncComponent, h } from 'vue'

const HeavyChart = defineAsyncComponent({
  loader: () => import('./components/HeavyChart.vue'),

  // 自定義加載中組件
  loadingComponent: {
    template: `
      <div class="chart-loading">
        <div class="spinner"></div>
        <p>圖表渲染引擎加載中...</p>
      </div>
    `
  },

  // 自定義出錯組件
  errorComponent: {
    props: ['error'],
    setup(props) {
      return () => h('div', { class: 'chart-error' }, [
        h('p', '圖表加載失敗'),
        h('button', {
          onClick: () => window.location.reload()
        }, '刷新重試')
      ])
    }
  },

  delay: 200,     // 延遲 200ms 再顯示 loading 組件
  timeout: 30000,  // 30 秒超時

  // 加載失敗重試
  onError(error, retry, fail) {
    if (error.message.includes('Network')) {
      retry() // 網絡錯誤自動重試
    } else {
      fail()  // 其他錯誤直接顯示錯誤組件
    }
  }
})
```

## 動態組件 + 異步組件：權限驅動的頁面渲染

在後台管理系統中，不同角色看到的頁面模塊不同。

```javascript
// utils/componentMap.js
export const componentMap = {
  'dashboard': () => import('../views/Dashboard.vue'),
  'user-manage': () => import('../views/UserManage.vue'),
  'order-manage': () => import('../views/OrderManage.vue'),
  'finance-report': () => import('../views/FinanceReport.vue'),
  'system-config': () => import('../views/SystemConfig.vue')
}

// 組件中使用
import { defineAsyncComponent, computed } from 'vue'
import { componentMap } from '../utils/componentMap'

export default {
  props: { moduleName: String },
  setup(props) {
    const currentComponent = computed(() => {
      const loader = componentMap[props.moduleName]
      if (!loader) {
        return { template: '<div>404 模塊不存在</div>' }
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
- `<keep-alive>` 緩存組件實例，`include` 和 `max` 控制緩存範圍
- `defineAsyncComponent` 實現組件級代碼拆分，配合 `Suspense` 管理加載態
- 生產環境中務必配置 `errorComponent` 和 `onError`，給用户優雅的降級體驗
