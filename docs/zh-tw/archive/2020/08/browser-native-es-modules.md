---
title: "瀏覽器原生 ES Modules 實踐"
date: 2020-08-10 10:47:29
tags:
  - 工程化
readingTime: 4
description: "瀏覽器對 ES Modules 的支援已經相當成熟了。現在 Chrome、Firefox、Safari、Edge 都支援 `<script type=\"module\">`，這意味著在開發階段甚至某些簡單專案中，我們可能不再需要打包工具。這篇文章整理一下瀏覽器原生 ESM 的實踐方式和注意點。"
---

瀏覽器對 ES Modules 的支援已經相當成熟了。現在 Chrome、Firefox、Safari、Edge 都支援 `<script type="module">`，這意味著在開發階段甚至某些簡單專案中，我們可能不再需要打包工具。這篇文章整理一下瀏覽器原生 ESM 的實踐方式和注意點。

## 基本用法

```html
<!-- 使用 type="module" 引入 ES Module -->
<script type="module" src="/js/app.js"></script>

<!-- 也可以內聯寫 -->
<script type="module">
  import { createApp } from '/js/vue.esm-browser.js'
  import App from '/js/App.js'

  createApp(App).mount('#app')
</script>
```

## 關鍵特性

### 1. 自動延遲載入

`<script type="module">` 預設是 defer 的，不需要手動加 `defer`：

```html
<!-- 這兩個效果一樣 -->
<script type="module" src="app.js"></script>
<script type="module" src="app.js" defer></script>

<!-- 普通 script 需要手動 defer -->
<script src="legacy.js" defer></script>
```

多個 module script 按照在 HTML 中的宣告順序執行。

### 2. 嚴格模式

ES Module 預設執行在嚴格模式下，不需要手動寫 `'use strict'`：

```javascript
// module.js — 自動嚴格模式
// 不能使用 with 語句
// this 在頂層是 undefined 而非 window
// 變數必須聲明後使用

console.log(this) // undefined（非嚴格模式下是 window）

undeclaredVar = 42 // ReferenceError: undeclaredVar is not defined
```

### 3. 作用域隔離

每個模組有獨立的作用域，不會汙染全域性：

```javascript
// module-a.js
const name = 'module-a'
function greet() {
  return `Hello from ${name}`
}
export { greet }

// module-b.js
// 這裡的 name 和 greet 完全獨立，不會衝突
const name = 'module-b'
function greet() {
  return `Hi from ${name}`
}
export { greet }
```

### 4. import 必須帶副檔名

這是和打包工具最大的區別 —— 瀏覽器原生 ESM 不會自動補全副檔名：

```javascript
// 正確 — 必須寫完整的 .js 副檔名
import { sum } from './utils.js'
import App from './App.js'
import { config } from '../config.js'

// 錯誤 — 瀏覽器會報 404
import { sum } from './utils'
import App from './App'
```

這在實際開發中需要特別注意，Node.js 也同樣如此。

### 5. bare module specifier 問題

裸模組說明符（bare specifier）如 `import { ref } from 'vue'` 在瀏覽器中無法直接工作，因為瀏覽器不知道 `vue` 對應哪個 URL。解決方法：

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
  import { ref } from 'vue' // 現在可以工作了
  import { debounce } from 'lodash-es'
</script>
```

```html
<!-- 方案二：直接寫完整 URL -->
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

## 實戰：搭建一個純 ESM 的 Vue 3 專案

不使用 Vite、不使用 Webpack，純原生 ESM + Vue 3：

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
      { id: 1, text: '學習 Vue 3', done: false },
      { id: 2, text: '嘗試原生 ESM', done: true }
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
      <p>剩餘 {{ remaining }} 項</p>
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

## 本地開發需要靜態檔案伺服器

直接用 `file://` 協議開啟 HTML 是不行的，因為 ES Module 的 CORS 限制：

```bash
# 方案一：Python
python3 -m http.server 8080

# 方案二：Node.js
npx serve .

# 方案三：live-server（帶熱過載）
npx live-server .
```

## 效能考量

原生 ESM 在開發環境有優勢，但生產環境需要謹慎：

```html
<!-- 問題：每個 import 都是一個獨立的 HTTP 請求 -->
<script type="module" src="/src/main.js"></script>
<!-- main.js import 了 App.js
     App.js import 了 TodoList.js 和 TodoInput.js
     TodoList.js import 了 Vue 的 h 函式
     ... 可能產生幾十甚至上百個請求 -->
```

對於小型專案、原型、演示頁面，原生 ESM 完全夠用。對於生產專案，目前還是建議用 Vite 或 Webpack 打包 —— Vite 在開發時用原生 ESM，構建時用 Rollup 打包，是目前最好的折中方案。

## 動態 import

瀏覽器原生支援動態 import，實現按需載入：

```javascript
// 點選按鈕時才載入
document.getElementById('loadChart').addEventListener('click', async () => {
  const { Chart } = await import('./chart.js')
  new Chart('#canvas', data)
})

// 路由級別程式碼分割
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

## 小結

- 瀏覽器原生 ESM 已經得到主流瀏覽器全面支援
- `type="module"` 預設嚴格模式、延遲載入、作用域隔離
- import 必須帶完整副檔名，裸模組說明符需要 import maps 或 URL 對映
- 本地開發需要靜態檔案伺服器，不能用 `file://`
- 小型專案和原型可以直接用原生 ESM，無需打包工具
- 生產專案建議用 Vite，開發時用原生 ESM，構建時打包最佳化
