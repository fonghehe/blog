---
title: "qiankun Micro Frontend Integration Guide: From Zero to One"
date: 2021-06-21 11:47:23
tags:
  - Micro Frontend
  - Engineering

readingTime: 2
description: "上一篇聊了微前端架构设计，这篇写具体的技术接入。我们用 qiankun 接入了 6 个子应用，包含 Vue 2、Vue 3 和 React 三种技术栈。记录主应用配置、子应用改造和常见问题。"
wordCount: 392
---

上一篇聊了微前端架构设计，这篇写具体的技术接入。我们用 qiankun 接入了 6 个子应用，包含 Vue 2、Vue 3 和 React 三种技术栈。记录主应用配置、子应用改造和常见问题。

## Main App Configuration

主应用负责注册子应用和生命周期管理：

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

子应用需要暴露三个生命周期钩子。以 Vue 2 子应用为例：

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

子应用需要修改打包配置，暴露 publicPath 和生命周期钩子：

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

qiankun 提供了两种 CSS 隔离方案：

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

我们最终用的是 `experimentalStyleIsolation`，因为 `strictStyleIsolation` 下弹窗组件的样式会被隔离导致位置异常。

## Common Issues

**1. 子应用静态资源 404**

子应用的 `publicPath` 需要动态设置：

```javascript
// main.js
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
}
```

**2. 子应用间路由跳转**

子应用内跳转用自身的 router，跳转到其他子应用需要使用主应用提供的方法：

```javascript
// 主应用提供跳转方法
window.__MAIN_APP_NAVIGATE__ = (path) => {
  router.push(path)
}

// 子应用中使用
window.__MAIN_APP_NAVIGATE__('/user/profile')
```

**3. 子应用 keep-alive**

qiankun 默认不支持 keep-alive，每次切换都会销毁重建。我们通过缓存 DOM 和状态来模拟，但体验一般。如果你的场景需要频繁切换子应用，建议评估 single-spa 的方案。

## Summary

- qiankun 接入的核心是子应用暴露三个生命周期钩子
- CSS 隔离推荐 `experimentalStyleIsolation`
- publicPath 动态设置和跨域配置是最常见的接入问题
- 子应用间通信要克制，优先用主应用中转
- keep-alive 支持是 qiankun 的短板，需要额外处理