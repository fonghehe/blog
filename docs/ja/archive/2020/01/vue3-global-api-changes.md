---
title: "Vue 3 グローバルAPIの変更と移行"
date: 2020-01-29 15:44:45
tags:
  - Vue
readingTime: 3
description: "Vue 3 ではグローバル API がコンストラクターパターンからファクトリ関数パターンに変更され、すべての操作は createApp が返すアプリケーションインスタンスを介して行われます。つまり、Vue 2 でおなじみの Vue.use、Vue.component、Vue.directive はすべて調整が必要です。この記事ではこれらの変更を整理し、移行方法を紹介します。"
wordCount: 617
---

Vue 3 では、グローバル API がコンストラクタパターンからファクトリ関数パターンに変更され、すべての操作は `createApp` が返すアプリケーションインスタンスを介して行われます。つまり、Vue 2 でおなじみの `Vue.use`、`Vue.component`、`Vue.directive` はすべて調整が必要です。この記事ではこれらの変更を整理し、移行方法を紹介します。

## createAppがnew Vueに代わる

Vue 2 はコンストラクタでインスタンスを作成し、Vue 3 はファクトリ関数でアプリケーションを作成します。

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

コンポーネント、ディレクティブ、ミックスインの登録方法はすべて app インスタンスに移行しました。

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

重要な違いは、各 `createApp` インスタンスが独立したグローバル登録スペースを持つことです。あるアプリケーションで登録したコンポーネントが別のアプリケーションに影響を与えることはありません。

## 削除または変更されたAPI

Vue 3 では、使用頻度が低い、または問題のある API が削除されました。

```javascript
{% raw %}
// Vue 2 の以下の API は Vue 3 で削除または置き換えられました

// 削除：$on / $off / $once（イベントバス）
// 代替案：mitt または tiny-emitter を使用
import mitt from 'mitt'
const emitter = mitt()

emitter.on('update', (payload) => {
  console.log('收到事件:', payload)
})
emitter.emit('update', { id: 1 })

// 削除：フィルター filter
// Vue 2
// <p>{{ price | currency }}</p>
// filters: { currency: val => `¥${val}` }
// Vue 3：メソッドまたは computed で置き換え
// <p>{{ currency(price) }}</p>

// 削除：$set / $delete
// Vue 3 の Proxy リアクティブシステムではこれらの API は不要です
const state = reactive({ items: [] })
state.items.push({ id: 1 }) // 直接操作でリアクティブがトリガーされます
delete state.items[0]        // 削除も Proxy にインターセプトされます

// 変更：$children
// Vue 2: this.$children[0]
// Vue 3: $refs または inject/provide を使用
{% endraw %}
```

## 移行戦略と段階的アップグレード

大規模なプロジェクトの場合、すべてのコードを一度に移行する必要はありません。

```javascript
// 互換レイヤー：Vue 2 と Vue 3 の両方をサポート
const install = (appOrVue) => {
  // Vue 3: app.use() の場合は app を渡す
  // Vue 2: Vue.use() の場合は Vue コンストラクタを渡す
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

`@vue/compat` 互換レイヤーを使用すると、Vue 3 で Vue 2 のコードを実行しながら段階的に移行できます。

```javascript
// main.js - 互換モードを使用
import { createApp } from '@vue/compat'
import App from './App.vue'

const app = createApp(App)

// Vue 2 モードで動作しますが、内部は Vue 3 です
// コンソールに削除予定の API が警告として表示されます
app.config.compatConfig = {
  MODE: 2 // 完全な Vue 2 互換
}

app.mount('#app')
```

## まとめ

- `createApp` が `new Vue` に代わり、すべてのグローバル API が app インスタンスにマウントされます
- 各 app インスタンスは独立したグローバル登録スペースを持ち、マルチアプリケーションの分離をサポートします
- イベントバス `$on/$off`、フィルター、`$set/$delete` は削除されたため、代替手段が必要です
- `@vue/compat` 互換レイヤーを使用することで段階的に移行でき、一度にすべてを変更する必要はありません
