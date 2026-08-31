---
title: "Vue 3 Global API Changes and Migration"
date: 2020-01-29 15:44:45
tags:
  - Vue
readingTime: 2
description: "Vue 3 changed the global API from a constructor pattern to a factory-function pattern; all operations go through the app instance returned by `createApp`. This means familiar Vue 2 calls like `Vue.use`, `Vue.component`, and `Vue.directive` all need adjustment. This article covers these changes and provides a migration plan."
wordCount: 215
---

Vue 3 changed the global API from a constructor pattern to a factory-function pattern; all operations go through the app instance returned by `createApp`. This means the familiar Vue 2 calls—`Vue.use`, `Vue.component`, `Vue.directive`—all need to be adjusted. This article goes through these changes and offers a migration plan.

## createApp Replaces new Vue

Vue 2 creates an instance through a constructor, while Vue 3 creates an app through a factory function.

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

## Changes to Global Registration

The registration of components, directives, and mixins all moved onto the app instance.

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

Key difference: every `createApp` instance has its own isolated global registration space. Components registered by one app won't pollute another.

## Removed or Adjusted APIs

Vue 3 removed a batch of low-frequency or problematic APIs.

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

## Migration Strategy and Incremental Upgrade

For large projects, you don't have to migrate all the code at once.

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

Using the `@vue/compat` compatibility layer lets you keep running Vue 2 code inside Vue 3 and migrate gradually.

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

## Summary

- `createApp` replaces `new Vue`, and all global APIs are mounted on the app instance.
- Each app instance has its own isolated global registration space, supporting multi-app isolation.
- The event bus (`$on/$off`), filters, and `$set/$delete` have been removed and need alternatives.
- The `@vue/compat` compatibility layer enables incremental migration, so you don't have to do it all at once.
