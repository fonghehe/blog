---
title: "qiankun マイクロフロントエンド統合ガイド：0から1へ"
date: 2021-06-21 11:47:23
tags:
  - マイクロフロントエンド
  - エンジニアリング

readingTime: 3
description: "上一篇聊了微前端架构设计，这篇写具体的技术接入。我们用 qiankun 接入了 6 个子应用，包含 Vue 2、Vue 3 和 React 三种技术栈。记录主应用配置、子应用改造和常见问题。"
wordCount: 717
---

前回の記事ではマイクロフロントエンドのアーキテクチャ設計について書き、今回は具体的な技術的な組み込みについて書く。私たちは qiankun を使って 6 つのサブアプリケーション（Vue 2、Vue 3、React の 3 つの技術スタックを含む）を組み込んだ。メインアプリの設定、サブアプリの改修、よくある問題を記録する。

## メインアプリの設定

メインアプリはサブアプリの登録とライフサイクル管理を担う：

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

## サブアプリの改造

サブアプリは3つのライフサイクルフックを公開する必要がある。例として Vue 2 のサブアプリを見てみる：

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

## Webpack 設定の調整

サブアプリはバンドル設定を変更し、`publicPath` とライフサイクルフックを公開する必要がある：

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

## CSS 分離アプローチ

qiankun は2つの CSS 分離のアプローチを提供している：

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

最終的に私たちが採用したのは `experimentalStyleIsolation` で、理由は `strictStyleIsolation` ではモーダルコンポーネントのスタイルが分離されて位置がおかしくなるためだ。

## よくある問題

**1. サブアプリの静的リソース 404**

サブアプリの `publicPath` は動的に設定する必要がある：

```javascript
// main.js
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
}
```

**2. サブアプリ間のルーティング遷移**

サブアプリ内の遷移には自身の router を使い、他のサブアプリへの遷移にはメインアプリが提供するメソッドを使う必要がある：

```javascript
// 主应用提供跳转方法
window.__MAIN_APP_NAVIGATE__ = (path) => {
  router.push(path)
}

// 子应用中使用
window.__MAIN_APP_NAVIGATE__('/user/profile')
```

**3. サブアプリの keep-alive**

qiankun はデフォルトで keep-alive をサポートしておらず、切り替えのたびに破棄して再構築する。私たちは DOM と状態をキャッシュしてシミュレートしたが、体験はいまいちだ。頻繁にサブアプリを切り替える必要がある場合は、single-spa のアプローチの検討をおすすめする。

## まとめ

- qiankun 統合の核心は、サブアプリが3つのライフサイクルフックを公開することだ
- CSS の分離には `experimentalStyleIsolation` を推奨する
- `publicPath` の動的設定とクロスオリジン設定が、最も一般的な統合の問題だ
- サブアプリ間の通信は抑制的に行い、メインアプリの中継を優先する
- keep-alive のサポートは qiankun の弱点で、追加の対応が必要だ