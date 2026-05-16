---
title: "Native ES Modules in the Browser: A Practical Guide"
date: 2020-08-10 10:47:29
tags:
  - Engineering
readingTime: 4
description: "浏览器对 ES Modules 的支持已经相当成熟了。现在 Chrome、Firefox、Safari、Edge 都支持 `<script type=\"module\">`，这意味着在开发阶段甚至某些简单项目中，我们可能不再需要打包工具。这篇文章整理一下浏览器原生 ESM 的实践方式和注意点。"
---

浏览器对 ES Modules 的支持已经相当成熟了。现在 Chrome、Firefox、Safari、Edge 都支持 `<script type="module">`，这意味着在开发阶段甚至某些简单项目中，我们可能不再需要打包工具。这篇文章整理一下浏览器原生 ESM 的实践方式和注意点。

## Basic Usage

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

## Key Features

### 1. 自动延迟加载

`<script type="module">` 默认是 defer 的，不需要手动加 `defer`：

```html
<!-- 这两个效果一样 -->
<script type="module" src="app.js"></script>
<script type="module" src="app.js" defer></script>

<!-- 普通 script 需要手动 defer -->
<script src="legacy.js" defer></script>
```

多个 module script 按照在 HTML 中的声明顺序执行。

### 2. 严格模式

ES Module 默认运行在严格模式下，不需要手动写 `'use strict'`：

```javascript
// module.js — 自动严格模式
// 不能使用 with 语句
// this 在顶层是 undefined 而非 window
// 变量必须声明后使用

console.log(this) // undefined（非严格模式下是 window）

undeclaredVar = 42 // ReferenceError: undeclaredVar is not defined
```

### 3. 作用域隔离

每个模块有独立的作用域，不会污染全局：

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

### 4. import 必须带文件扩展名

这是和打包工具最大的区别 —— 浏览器原生 ESM 不会自动补全扩展名：

```javascript
// 正确 — 必须写完整的 .js 扩展名
import { sum } from './utils.js'
import App from './App.js'
import { config } from '../config.js'

// 错误 — 浏览器会报 404
import { sum } from './utils'
import App from './App'
```

这在实际开发中需要特别注意，Node.js 也同样如此。

### 5. bare module specifier 问题

裸模块说明符（bare specifier）如 `import { ref } from 'vue'` 在浏览器中无法直接工作，因为浏览器不知道 `vue` 对应哪个 URL。解决方法：

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

## In Practice: Building a Pure ESM Vue 3 Project

不使用 Vite、不使用 Webpack，纯原生 ESM + Vue 3：

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

## Local Development Requires a Static File Server

直接用 `file://` 协议打开 HTML 是不行的，因为 ES Module 的 CORS 限制：

```bash
# 方案一：Python
python3 -m http.server 8080

# 方案二：Node.js
npx serve .

# 方案三：live-server（带热重载）
npx live-server .
```

## Performance Considerations

原生 ESM 在开发环境有优势，但生产环境需要谨慎：

```html
<!-- 问题：每个 import 都是一个独立的 HTTP 请求 -->
<script type="module" src="/src/main.js"></script>
<!-- main.js import 了 App.js
     App.js import 了 TodoList.js 和 TodoInput.js
     TodoList.js import 了 Vue 的 h 函数
     ... 可能产生几十甚至上百个请求 -->
```

对于小型项目、原型、演示页面，原生 ESM 完全够用。对于生产项目，目前还是建议用 Vite 或 Webpack 打包 —— Vite 在开发时用原生 ESM，构建时用 Rollup 打包，是目前最好的折中方案。

## 动态 import

浏览器原生支持动态 import，实现按需加载：

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

## Summary

- 浏览器原生 ESM 已经得到主流浏览器全面支持
- `type="module"` 默认严格模式、延迟加载、作用域隔离
- import 必须带完整扩展名，裸模块说明符需要 import maps 或 URL 映射
- 本地开发需要静态文件服务器，不能用 `file://`
- 小型项目和原型可以直接用原生 ESM，无需打包工具
- 生产项目建议用 Vite，开发时用原生 ESM，构建时打包优化
