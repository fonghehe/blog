---
title: "qiankun 微前端接入指南：從 0 到 1"
date: 2021-06-21 11:47:23
tags:
  - 前端
  - 工程化
readingTime: 2
description: "上一篇聊了微前端架構設計，這篇寫具體的技術接入。我們用 qiankun 接入了 6 個子應用，包含 Vue 2、Vue 3 和 React 三種技術棧。記錄主應用配置、子應用改造和常見問題。"
---

上一篇聊了微前端架構設計，這篇寫具體的技術接入。我們用 qiankun 接入了 6 個子應用，包含 Vue 2、Vue 3 和 React 三種技術棧。記錄主應用配置、子應用改造和常見問題。

## 主應用配置

主應用負責註冊子應用和生命週期管理：

```javascript
// main.js - 主應用（Vue 3）
import { registerMicroApps, start, setDefaultMountApp } from 'qiankun'

registerMicroApps([
  {
    name: 'order-system',
    entry: '//order.company.com',
    container: '#sub-app-container',
    activeRule: '/order',
    props: {
      // 傳遞給子應用的資料
      authToken: getToken(),
      userInfo: getUserInfo(),
    }
  },
  {
    name: 'user-center',
    entry: '//user.company.com',
    container: '#sub-app-container',
    activeRule: '/user',
  },
  {
    name: 'data-dashboard',
    entry: '//dashboard.company.com',
    container: '#sub-app-container',
    activeRule: '/dashboard',
  }
], {
  beforeLoad: [
    (app) => {
      console.log('[主應用] before load', app.name)
      return Promise.resolve()
    }
  ],
  afterMount: [
    (app) => {
      console.log('[主應用] after mount', app.name)
      return Promise.resolve()
    }
  ]
})

setDefaultMountApp('/order')
start({
  prefetch: 'all',
  sandbox: { strictStyleIsolation: true }
})
```

## 子應用改造

子應用需要暴露三個生命週期鉤子。以 Vue 2 子應用為例：

```javascript
// src/main.js
import Vue from 'vue'
import App from './App.vue'
import router from './router'

let instance = null

function render(props = {}) {
  const { container, authToken, userInfo } = props

  instance = new Vue({
    router,
    render: h => h(App)
  }).$mount(container ? container.querySelector('#app') : '#app')

  // 使用主應用傳遞的資料
  if (authToken) {
    Vue.prototype.$authToken = authToken
    Vue.prototype.$userInfo = userInfo
  }
}

// 獨立執行時直接渲染
if (!window.__POWERED_BY_QIANKUN__) {
  render()
}

// qiankun 生命週期鉤子
export async function bootstrap() {
  console.log('[子應用] bootstrap')
}

export async function mount(props) {
  console.log('[子應用] mount', props)
  render(props)
}

export async function unmount() {
  console.log('[子應用] unmount')
  instance.$destroy()
  instance.$el.innerHTML = ''
  instance = null
}
```

## Webpack 配置調整

子應用需要修改打包配置，暴露 publicPath 和生命週期鉤子：

```javascript
// vue.config.js
const { name } = require('./package.json')

module.exports = {
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*' // 允許跨域
    }
  },
  configureWebpack: {
    output: {
      library: `${name}-[name]`,
      libraryTarget: 'umd',
      jsonpFunction: `webpackJsonp_${name}`
    }
  }
}
```

## CSS 隔離方案

qiankun 提供了兩種 CSS 隔離方案：

```javascript
start({
  sandbox: {
    // 方案一：strictStyleIsolation
    // 使用 Shadow DOM 隔離，相容性最好但有坑
    strictStyleIsolation: true,

    // 方案二：experimentalStyleIsolation
    // 使用 CSS 選擇器字首，推薦使用
    experimentalStyleIsolation: true
    // 效果：子應用的樣式會被加上 [data-qiankun="子應用名"] 字首
  }
})
```

我們最終用的是 `experimentalStyleIsolation`，因為 `strictStyleIsolation` 下彈窗元件的樣式會被隔離導致位置異常。

## 常見問題

**1. 子應用靜態資源 404**

子應用的 `publicPath` 需要動態設定：

```javascript
// main.js
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
}
```

**2. 子應用間路由跳轉**

子應用內跳轉用自身的 router，跳轉到其他子應用需要使用主應用提供的方法：

```javascript
// 主應用提供跳轉方法
window.__MAIN_APP_NAVIGATE__ = (path) => {
  router.push(path)
}

// 子應用中使用
window.__MAIN_APP_NAVIGATE__('/user/profile')
```

**3. 子應用 keep-alive**

qiankun 預設不支援 keep-alive，每次切換都會銷燬重建。我們通過快取 DOM 和狀態來模擬，但體驗一般。如果你的場景需要頻繁切換子應用，建議評估 single-spa 的方案。

## 小結

- qiankun 接入的核心是子應用暴露三個生命週期鉤子
- CSS 隔離推薦 `experimentalStyleIsolation`
- publicPath 動態設定和跨域配置是最常見的接入問題
- 子應用間通訊要剋制，優先用主應用中轉
- keep-alive 支援是 qiankun 的短板，需要額外處理