---
title: "Vue 3 グローバルAPIの変更と移行"
date: 2020-01-29 15:44:45
tags:
  - Vue
readingTime: 2
description: "Vue 3 将全局 API 从构造函数模式改为工厂函数模式，所有操作都通过 `createApp` 返回的应用实例进行。这意味着 Vue 2 中常见的 `Vue.use`、`Vue.component`、`Vue.directive` 全部需要调整。本文梳理这些变更并给出迁移方案。"
wordCount: 338
---

Vue 3 将全局 API 从构造函数模式改为工厂函数模式，所有操作都通过 `createApp` 返回的应用实例进行。这意味着 Vue 2 中常见的 `Vue.use`、`Vue.component`、`Vue.directive` 全部需要调整。本文梳理这些变更并给出迁移方案。

## createAppがnew Vueに代わる

Vue 2 通过构造函数创建实例，Vue 3 通过工厂函数创建应用。

```javascript
// Vue 2
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'

Vue.use(ElementUI)
Vue.config.productionTip = false
Vue.prototype.$http = axios

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
```

```javascript
// Vue 3
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementPlus from 'element-plus'

const app = createApp(App)

app.use(ElementPlus)
app.use(router)
app.use(store)

// 替代 Vue.prototype
app.config.globalProperties.$http = axios

// 全局配置
app.config.performance = true
app.config.errorHandler = (err, vm, info) => {
  console.error('全局错误:', err, info)
}

app.mount('#app')
```

## グローバル登録の変更

组件、指令、混入的注册方式都移到了 app 实例上。

```javascript
// Vue 2
Vue.component('MyButton', MyButton)
Vue.directive('focus', { inserted: el => el.focus() })
Vue.mixin({ created() { console.log('mixin') } })

// Vue 3
const app = createApp(App)

app.component('MyButton', MyButton)
app.directive('focus', {
  mounted: el => el.focus()
})
app.mixin({ created() { console.log('mixin') } })
```

关键区别：每个 `createApp` 实例拥有独立的全局注册空间。一个应用注册的组件不会污染另一个应用。

## 削除または変更されたAPI

Vue 3 移除了一批低频或有问题的 API。

```javascript
{% raw %}
// Vue 2 中以下 API 在 Vue 3 中被移除或替换

// 移除：$on / $off / $once（事件总线）
// 替代方案：使用 mitt 或 tiny-emitter
import mitt from 'mitt'
const emitter = mitt()

emitter.on('update', (payload) => {
  console.log('收到事件:', payload)
})
emitter.emit('update', { id: 1 })

// 移除：过滤器 filter
// Vue 2
// <p>{{ price | currency }}</p>
// filters: { currency: val => `¥${val}` }
// Vue 3：使用方法或 computed 替代
// <p>{{ currency(price) }}</p>

// 移除：$set / $delete
// Vue 3 的 Proxy 响应式系统不需要这两个 API
const state = reactive({ items: [] })
state.items.push({ id: 1 }) // 直接操作即可触发响应式
delete state.items[0]        // 删除也会被 Proxy 拦截

// 调整：$children
// Vue 2: this.$children[0]
// Vue 3: 使用 $refs 或 inject/provide
{% endraw %}
```

## 迁移策略与渐进升级

对于大型项目，不必一次性迁移所有代码。

```javascript
// 兼容层写法：同时支持 Vue 2 和 Vue 3
const install = (appOrVue) => {
  // Vue 3: app.use() 时传入 app
  // Vue 2: Vue.use() 时传入 Vue 构造函数
  const isVue3 = appOrVue.createApp !== undefined

  if (isVue3) {
    appOrVue.component('MyPlugin', MyComponent)
    appOrVue.config.globalProperties.$myPlugin = pluginApi
  } else {
    appOrVue.component('MyPlugin', MyComponent)
    appOrVue.prototype.$myPlugin = pluginApi
  }
}

export default { install }
```

使用 `@vue/compat` 兼容层可以在 Vue 3 中继续运行 Vue 2 代码，逐步迁移。

```javascript
// main.js - 使用兼容模式
import { createApp } from '@vue/compat'
import App from './App.vue'

const app = createApp(App)

// 以 Vue 2 模式运行，但底层是 Vue 3
// 控制台会警告哪些 API 即将被移除
app.config.compatConfig = {
  MODE: 2 // 完全 Vue 2 兼容
}

app.mount('#app')
```

## まとめ

- `createApp` 替代 `new Vue`，所有全局 API 挂载到 app 实例上
- 每个 app 实例拥有独立的全局注册空间，支持多应用隔离
- 事件总线 `$on/$off`、过滤器、`$set/$delete` 已移除，需要寻找替代方案
- 使用 `@vue/compat` 兼容层可以渐进式迁移，不必一步到位
