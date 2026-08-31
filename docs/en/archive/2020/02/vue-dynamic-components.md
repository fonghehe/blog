---
title: "Vue Dynamic Components and Async Components"
date: 2020-02-07 17:08:14
tags:
  - Vue
readingTime: 3
description: "Dynamic components and async components are two powerful tools for building complex frontend applications. Dynamic components handle deciding which component to render at runtime, while async components handle loading component code on demand. Combined, they enable a highly flexible page architecture."
wordCount: 245
---

Dynamic components and async components are two powerful tools for building complex front-end applications. Dynamic components solve the problem of deciding which component to render at runtime, while async components solve the problem of loading component code on demand. Combined, they enable a highly flexible page architecture.

## Basic Usage of the component Tag

`<component :is="...">` lets you swap the rendered component dynamically based on data.

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

    <!-- 动态切换组件 -->
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

Note that we use `shallowRef` instead of `ref` here. A component object doesn't need deep reactivity, so `shallowRef` avoids wrapping the component definition in an unnecessary Proxy, which is better for performance.

## Caching State with keep-alive

Switching components dynamically causes state to be lost. Use `<keep-alive>` to cache component instances.

```vue
<template>
  <div>
    <nav>
      <button @click="view = 'List'">列表</button>
      <button @click="view = 'Form'">表单</button>
      <button @click="view = 'Chart'">图表</button>
    </nav>

    <!-- 缓存已访问过的组件实例 -->
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

    // 只缓存指定组件
    const cachedViews = computed(() => {
      if (view.value === 'Chart') return [] // 图表不缓存
      return ['List', 'Form']
    })

    return { view, cachedViews }
  }
}
</script>
```

`keep-alive`'s `include` accepts an array of component names or a regex, and `max` caps the number of cached instances to prevent memory leaks.

## Async Components and `defineAsyncComponent`

For large components (rich-text editors, maps, chart libraries), loading them only when needed can significantly shrink the initial bundle.

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

## Advanced Configuration: Timeout and Error Handling

`defineAsyncComponent` supports full control over the loading lifecycle.

```javascript
import { defineAsyncComponent, h } from 'vue'

const HeavyChart = defineAsyncComponent({
  loader: () => import('./components/HeavyChart.vue'),

  // 自定义加载中组件
  loadingComponent: {
    template: `
      <div class="chart-loading">
        <div class="spinner"></div>
        <p>图表渲染引擎加载中...</p>
      </div>
    `
  },

  // 自定义出错组件
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

  delay: 200,     // 延迟 200ms 再显示 loading 组件
  timeout: 30000,  // 30 秒超时

  // 加载失败重试
  onError(error, retry, fail) {
    if (error.message.includes('Network')) {
      retry() // 网络错误自动重试
    } else {
      fail()  // 其他错误直接显示错误组件
    }
  }
})
```

## Dynamic + Async Components: Permission-Driven Page Rendering

In an admin dashboard, different roles see different page modules.

```javascript
// utils/componentMap.js
export const componentMap = {
  'dashboard': () => import('../views/Dashboard.vue'),
  'user-manage': () => import('../views/UserManage.vue'),
  'order-manage': () => import('../views/OrderManage.vue'),
  'finance-report': () => import('../views/FinanceReport.vue'),
  'system-config': () => import('../views/SystemConfig.vue')
}

// 组件中使用
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

## Summary

- `<component :is>` is the core of dynamic rendering, and `shallowRef` avoids unnecessary Proxy overhead
- `<keep-alive>` caches component instances, while `include` and `max` control the cache scope
- `defineAsyncComponent` enables component-level code splitting, and pairs with `Suspense` to manage loading states
- In production, always configure `errorComponent` and `onError` so users get a graceful fallback
