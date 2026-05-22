---
title: "Vue 3 全域性 API 變更與遷移"
date: 2020-01-29 15:44:45
tags:
  - Vue
readingTime: 2
description: "Vue 3 將全域性 API 從建構函式模式改為工廠函式模式，所有操作都通過 `createApp` 返回的應用例項進行。這意味著 Vue 2 中常見的 `Vue.use`、`Vue.component`、`Vue.directive` 全部需要調整。本文梳理這些變更並給出遷移方案。"
wordCount: 337
---

Vue 3 將全域性 API 從建構函式模式改為工廠函式模式，所有操作都通過 `createApp` 返回的應用例項進行。這意味著 Vue 2 中常見的 `Vue.use`、`Vue.component`、`Vue.directive` 全部需要調整。本文梳理這些變更並給出遷移方案。

## createApp 取代 new Vue

Vue 2 通過建構函式建立例項，Vue 3 通過工廠函式建立應用。

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

// 全域性配置
app.config.performance = true
app.config.errorHandler = (err, vm, info) => {
  console.error('全域性錯誤:', err, info)
}

app.mount('#app')
```

## 全域性註冊的變更

元件、指令、混入的註冊方式都移到了 app 例項上。

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

關鍵區別：每個 `createApp` 例項擁有獨立的全域性註冊空間。一個應用註冊的元件不會汙染另一個應用。

## 被移除或調整的 API

Vue 3 移除了一批低頻或有問題的 API。

```javascript
{% raw %}
// Vue 2 中以下 API 在 Vue 3 中被移除或替換

// 移除：$on / $off / $once（事件匯流排）
// 替代方案：使用 mitt 或 tiny-emitter
import mitt from 'mitt'
const emitter = mitt()

emitter.on('update', (payload) => {
  console.log('收到事件:', payload)
})
emitter.emit('update', { id: 1 })

// 移除：過濾器 filter
// Vue 2
// <p>{{ price | currency }}</p>
// filters: { currency: val => `¥${val}` }
// Vue 3：使用方法或 computed 替代
// <p>{{ currency(price) }}</p>

// 移除：$set / $delete
// Vue 3 的 Proxy 響應式系統不需要這兩個 API
const state = reactive({ items: [] })
state.items.push({ id: 1 }) // 直接操作即可觸發響應式
delete state.items[0]        // 刪除也會被 Proxy 攔截

// 調整：$children
// Vue 2: this.$children[0]
// Vue 3: 使用 $refs 或 inject/provide
{% endraw %}
```

## 遷移策略與漸進升級

對於大型專案，不必一次性遷移所有程式碼。

```javascript
// 相容層寫法：同時支援 Vue 2 和 Vue 3
const install = (appOrVue) => {
  // Vue 3: app.use() 時傳入 app
  // Vue 2: Vue.use() 時傳入 Vue 建構函式
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

使用 `@vue/compat` 相容層可以在 Vue 3 中繼續執行 Vue 2 程式碼，逐步遷移。

```javascript
// main.js - 使用相容模式
import { createApp } from '@vue/compat'
import App from './App.vue'

const app = createApp(App)

// 以 Vue 2 模式執行，但底層是 Vue 3
// 控製臺會警告哪些 API 即將被移除
app.config.compatConfig = {
  MODE: 2 // 完全 Vue 2 相容
}

app.mount('#app')
```

## 小結

- `createApp` 替代 `new Vue`，所有全域性 API 掛載到 app 例項上
- 每個 app 例項擁有獨立的全域性註冊空間，支援多應用隔離
- 事件匯流排 `$on/$off`、過濾器、`$set/$delete` 已移除，需要尋找替代方案
- 使用 `@vue/compat` 相容層可以漸進式遷移，不必一步到位
