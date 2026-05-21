---
title: "Vue Dynamic Components and Async Components"
date: 2020-02-07 17:08:14
tags:
  - Vue
readingTime: 3
description: "动态组件和异步组件是构建复杂前端应用的两把利器。动态组件解决\"运行时决定渲染哪个组件\"的问题，异步组件解决\"按需加载组件代码\"的问题。两者结合使用，可以实现高度灵活的页面架构。"
wordCount: 396
---

动态组件和异步组件是构建复杂前端应用的两把利器。动态组件解决"运行时决定渲染哪个组件"的问题，异步组件解决"按需加载组件代码"的问题。两者结合使用，可以实现高度灵活的页面架构。

## Basic Usage of the component Tag

`<component :is="...">` 允许根据数据动态切换渲染的组件。

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

注意这里用 `shallowRef` 而非 `ref`。组件对象本身不需要深度响应式，用 `shallowRef` 可以避免对组件定义对象做不必要的 Proxy 包裹，性能更好。

## Caching State with keep-alive

动态切换组件会导致状态丢失。用 `<keep-alive>` 缓存组件实例。

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

`keep-alive` 的 `include` 接受组件名称数组或正则，`max` 限制最大缓存数量，防止内存泄漏。

## 异步组件与 defineAsyncComponent

对于大型组件（富文本编辑器、地图、图表库），只在需要时加载可以显著减小首屏 bundle。

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

## 高级配置：超时与错误处理

`defineAsyncComponent` 支持完整的加载生命周期控制。

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

## 动态组件 + 异步组件：权限驱动的页面渲染

在后台管理系统中，不同角色看到的页面模块不同。

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

- `<component :is>` 是动态渲染的核心，`shallowRef` 避免不必要的 Proxy 开销
- `<keep-alive>` 缓存组件实例，`include` 和 `max` 控制缓存范围
- `defineAsyncComponent` 实现组件级代码拆分，配合 `Suspense` 管理加载态
- 生产环境中务必配置 `errorComponent` 和 `onError`，给用户优雅的降级体验
