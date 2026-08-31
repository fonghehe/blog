---
title: "ブラウザネイティブES Modules 実践ガイド"
date: 2020-08-10 10:47:29
tags:
  - エンジニアリング
readingTime: 5
description: "浏览器对 ES Modules 的支持已经相当成熟了。现在 Chrome、Firefox、Safari、Edge 都支持 `<script type=\"module\">`，这意味着在开发阶段甚至某些简单项目中，我们可能不再需要打包工具。这篇文章整理一下浏览器原生 ESM 的实践方式和注意点。"
wordCount: 939
---

ブラウザの ES Modules 対応はすでに十分に成熟している。現在は Chrome、Firefox、Safari、Edge のすべてが `<script type="module">` をサポートしており、開発時や単純なプロジェクトによってはバンドラが不要になる。この記事ではブラウザネイティブな ESM の実践方法と注意点を整理する。

## 基本的な使い方

```html
<!-- 使用 type="module" 引入 ES Module -->
<script type="module" src="/js/app.js"></script>

<!-- 也可以内联写 -->
<script type="module">
  import { createApp } from '/js/vue.esm-browser.js'
  import App from '/js/App.js'

  createApp(App).mount('#app')
</script>
```

## 主要な特徴

### 1. 自動遅延読み込み

`<script type="module">` はデフォルトで defer 扱いになるため、手動で `defer` を付ける必要はない：

```html
<!-- 这两个效果一样 -->
<script type="module" src="app.js"></script>
<script type="module" src="app.js" defer></script>

<!-- 普通 script 需要手动 defer -->
<script src="legacy.js" defer></script>
```

複数の module スクリプトは、HTML 上の記述順に従って実行される。

### 2. 厳格モード

ES Module はデフォルトで strict モード（厳格モード）で実行され、`'use strict'` を明示的に書く必要はない：

```javascript
// module.js — 自动严格模式
// 不能使用 with 语句
// this 在顶层是 undefined 而非 window
// 变量必须声明后使用

console.log(this) // undefined（非严格模式下是 window）

undeclaredVar = 42 // ReferenceError: undeclaredVar is not defined
```

### 3. スコープの分離

各モジュールは独立したスコープを持ち、グローバルを汚染しない：

```javascript
// module-a.js
const name = 'module-a'
function greet() {
  return `Hello from ${name}`
}
export { greet }

// module-b.js
// 这里的 name 和 greet 完全独立，不会冲突
const name = 'module-b'
function greet() {
  return `Hi from ${name}`
}
export { greet }
```

### 4. import には拡張子が必要

これがバンドラとの最大の違いだ。ブラウザネイティブな ESM は拡張子を自動補完しない：

```javascript
// 正确 — 必须写完整的 .js 扩展名
import { sum } from './utils.js'
import App from './App.js'
import { config } from '../config.js'

// 错误 — 浏览器会报 404
import { sum } from './utils'
import App from './App'
```

実際の開発では特に注意が必要だ。Node.js でも同様である。

### 5. bare module specifier の問題

ベアモジュール指定子（bare specifier）――たとえば `import { ref } from 'vue'` のように書くと、ブラウザは `vue` がどの URL に対応するか分からないため、そのままでは動作しない。解決策は以下の通り：

```html
<!-- 方案一：使用 Import Maps（Chrome 89+） -->
<script type="importmap">
{
  "imports": {
    "vue": "/node_modules/vue/dist/vue.esm-browser.js",
    "lodash-es": "/node_modules/lodash-es/lodash.js"
  }
}
</script>
<script type="module">
  import { ref } from 'vue' // 现在可以工作了
  import { debounce } from 'lodash-es'
</script>
```

```html
<!-- 方案二：直接写完整 URL -->
<script type="module">
  import { ref } from '/node_modules/vue/dist/vue.esm-browser.js'
</script>
```

```html
<!-- 方案三：使用 CDN 的 ES Module 版本 -->
<script type="module">
  import { ref, computed } from 'https://cdn.jsdelivr.net/npm/vue@3.0.0-beta.22/dist/vue.esm-browser.js'
</script>
```

## 実践：純粋なESM Vue 3プロジェクトの構築

Vite も Webpack も使わず、純粋なネイティブ ESM + Vue 3 で構築する：

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pure ESM Vue 3 App</title>

  <script type="importmap">
  {
    "imports": {
      "vue": "/vendor/vue.esm-browser.js"
    }
  }
  </script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

```javascript
// src/main.js
import { createApp } from 'vue'
import App from './App.js'

createApp(App).mount('#app')
```

```javascript
{% raw %}
// src/App.js
import { ref, computed } from 'vue'
import TodoList from './components/TodoList.js'
import TodoInput from './components/TodoInput.js'

export default {
  name: 'App',
  components: { TodoList, TodoInput },
  setup() {
    const todos = ref([
      { id: 1, text: '学习 Vue 3', done: false },
      { id: 2, text: '尝试原生 ESM', done: true }
    ])

    const remaining = computed(() => todos.value.filter(t => !t.done).length)

    function addTodo(text) {
      todos.value.push({
        id: Date.now(),
        text,
        done: false
      })
    }

    function toggleTodo(id) {
      const todo = todos.value.find(t => t.id === id)
      if (todo) todo.done = !todo.done
    }

    return { todos, remaining, addTodo, toggleTodo }
  },
  template: `
    <div class="app">
      <h1>Todo App</h1>
      <p>剩余 {{ remaining }} 项</p>
      <TodoInput @add="addTodo" />
      <TodoList :todos="todos" @toggle="toggleTodo" />
    </div>
  `
}
{% endraw %}
```

```javascript
// src/components/TodoList.js
import { h } from 'vue'

export default {
  name: 'TodoList',
  props: {
    todos: { type: Array, required: true }
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () => h('ul', { class: 'todo-list' },
      props.todos.map(todo =>
        h('li', {
          key: todo.id,
          class: { done: todo.done },
          onClick: () => emit('toggle', todo.id)
        }, todo.text)
      )
    )
  }
}
```

## ローカル開発には静的ファイルサーバーが必要

HTML を `file://` プロトコルで直接開くことはできない。ES Module には CORS の制約があるためだ：

```bash
# 方案一：Python
python3 -m http.server 8080

# 方案二：Node.js
npx serve .

# 方案三：live-server（带热重载）
npx live-server .
```

## パフォーマンスの考慮

ネイティブ ESM は開発環境では有利だが、本番環境では慎重な検討が必要だ：

```html
<!-- 问题：每个 import 都是一个独立的 HTTP 请求 -->
<script type="module" src="/src/main.js"></script>
<!-- main.js import 了 App.js
     App.js import 了 TodoList.js 和 TodoInput.js
     TodoList.js import 了 Vue 的 h 函数
     ... 可能产生几十甚至上百个请求 -->
```

小規模なプロジェクトやプロトタイプ、デモページであればネイティブ ESM で十分だ。本番プロジェクトであれば、現時点では Vite や Webpack でバンドルすることを推奨する。Vite は開発時にはネイティブ ESM を使い、ビルド時には Rollup でバンドルするため、現在のところ最良の妥協案と言える。

## 動的 import

ブラウザは動的 import をネイティブにサポートしており、必要に応じた遅延ロードが実現できる：

```javascript
// 点击按钮时才加载
document.getElementById('loadChart').addEventListener('click', async () => {
  const { Chart } = await import('./chart.js')
  new Chart('#canvas', data)
})

// 路由级别代码分割
async function loadRoute(routeName) {
  const routes = {
    home: () => import('./routes/home.js'),
    about: () => import('./routes/about.js'),
    dashboard: () => import('./routes/dashboard.js')
  }
  const module = await routes[routeName]()
  return module.default
}
```

## まとめ

- ブラウザネイティブな ESM は主要ブラウザですべてサポートされている
- `<script type="module">` はデフォルトで strict モード・遅延ロード・スコープ分離となる
- import には完全な拡張子が必要で、ベアモジュール指定子には import maps や URL マッピングが必要
- ローカル開発には静的ファイルサーバーが必要で、`file://` は利用できない
- 小規模なプロジェクトやプロトタイプはバンドラなしでネイティブ ESM を直接使える
- 本番プロジェクトでは Vite の利用を推奨。開発時はネイティブ ESM、ビルド時はバンドル最適化を行う
