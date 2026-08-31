---
title: "qiankun Micro Frontend Integration Guide: From Zero to One"
date: 2021-06-21 11:47:23
tags:
  - Micro Frontend
  - Engineering

readingTime: 2
description: "The previous article covered micro-frontend architecture design; this one covers the concrete technical integration. We onboarded six sub-applications with qiankun, spanning Vue 2, Vue 3, and React. Here are the main-app configuration, sub-app adaptations, and the common problems we hit."
wordCount: 263
---

The previous post covered micro-frontend architecture design; this one is about the actual technical integration. We integrated six sub-applications with qiankun, spanning three stacks — Vue 2, Vue 3, and React. Here I'll document the host-app configuration, sub-app refactoring, and the common pitfalls we hit.

## Main App Configuration

The host app is responsible for registering sub-apps and managing their lifecycle:

```javascript
// main.js - 主应用（Vue 3）
import { registerMicroApps, start, setDefaultMountApp } from 'qiankun'

registerMicroApps([
  {
    name: 'order-system',
    entry: '//order.company.com',
    container: '#sub-app-container',
    activeRule: '/order',
    props: {
      // 传递给子应用的数据
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
      console.log('[主应用] before load', app.name)
      return Promise.resolve()
    }
  ],
  afterMount: [
    (app) => {
      console.log('[主应用] after mount', app.name)
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

## Sub-App Transformation

A sub-app must expose three lifecycle hooks. Here's an example using a Vue 2 sub-app:

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

  // 使用主应用传递的数据
  if (authToken) {
    Vue.prototype.$authToken = authToken
    Vue.prototype.$userInfo = userInfo
  }
}

// 独立运行时直接渲染
if (!window.__POWERED_BY_QIANKUN__) {
  render()
}

// qiankun 生命周期钩子
export async function bootstrap() {
  console.log('[子应用] bootstrap')
}

export async function mount(props) {
  console.log('[子应用] mount', props)
  render(props)
}

export async function unmount() {
  console.log('[子应用] unmount')
  instance.$destroy()
  instance.$el.innerHTML = ''
  instance = null
}
```

## Webpack Configuration Adjustments

A sub-app needs to adjust its bundler config so it exposes `publicPath` and the lifecycle hooks:

```javascript
// vue.config.js
const { name } = require('./package.json')

module.exports = {
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*' // 允许跨域
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

## CSS Isolation Solutions

qiankun offers two CSS-isolation approaches:

```javascript
start({
  sandbox: {
    // 方案一：strictStyleIsolation
    // 使用 Shadow DOM 隔离，兼容性最好但有坑
    strictStyleIsolation: true,

    // 方案二：experimentalStyleIsolation
    // 使用 CSS 选择器前缀，推荐使用
    experimentalStyleIsolation: true
    // 效果：子应用的样式会被加上 [data-qiankun="子应用名"] 前缀
  }
})
```

We ended up using `experimentalStyleIsolation`, because under `strictStyleIsolation` the modal component's styles get sandboxed, which throws off its positioning.

## Common Issues

**1. Sub-app static assets return 404**

A sub-app's `publicPath` needs to be set dynamically:

```javascript
// main.js
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
}
```

**2. Routing between sub-apps**

Within a sub-app, navigation uses its own router; to jump to another sub-app, you use a method provided by the host app:

```javascript
// 主应用提供跳转方法
window.__MAIN_APP_NAVIGATE__ = (path) => {
  router.push(path)
}

// 子应用中使用
window.__MAIN_APP_NAVIGATE__('/user/profile')
```

**3. Sub-app keep-alive**

qiankun doesn't support keep-alive by default — every switch tears the app down and rebuilds it. We simulate it by caching the DOM and state, but the experience is mediocre. If your scenario needs frequent sub-app switching, consider evaluating a single-spa-based approach instead.

## Summary

- The core of qiankun integration is that sub-apps expose three lifecycle hooks.
- For CSS isolation, prefer `experimentalStyleIsolation`.
- Dynamic `publicPath` configuration and CORS setup are the most common integration issues.
- Keep inter-sub-app communication restrained; route it through the host app first.
- keep-alive is a weak spot in qiankun and needs extra handling.