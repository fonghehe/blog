---
title: "Native ES Modules in the Browser: A Practical Guide"
date: 2020-08-10 10:47:29
tags:
  - Engineering
readingTime: 3
description: "Browser support for ES Modules has matured: Chrome, Firefox, Safari, and Edge all support script type=module, which means for development — and even some simple projects — you may not need a bundler at all. This article walks through practical usage of native ESM in the browser."
wordCount: 375
---

Browser support for ES Modules is now quite mature. Chrome, Firefox, Safari, and Edge all support `<script type="module">`, which means that during development — and even for some simple projects — you may no longer need a bundler. This article summarizes practical approaches and gotchas for using native ESM in the browser.

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

### 1. Automatic Deferred Loading

`<script type="module">` is deferred by default, so you don't need to add `defer` manually:

```html
<!-- 这两个效果一样 -->
<script type="module" src="app.js"></script>
<script type="module" src="app.js" defer></script>

<!-- 普通 script 需要手动 defer -->
<script src="legacy.js" defer></script>
```

Multiple module scripts execute in the order they are declared in the HTML.

### 2. Strict Mode

ES modules run in strict mode by default, so you don't need to write `'use strict'` manually:

```javascript
// module.js — 自动严格模式
// 不能使用 with 语句
// this 在顶层是 undefined 而非 window
// 变量必须声明后使用

console.log(this) // undefined（非严格模式下是 window）

undeclaredVar = 42 // ReferenceError: undeclaredVar is not defined
```

### 3. Scope Isolation

Each module has its own scope and won't pollute the global namespace:

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

### 4. Imports Must Include the File Extension

This is the biggest difference from bundlers — native browser ESM does not auto-complete file extensions:

```javascript
// 正确 — 必须写完整的 .js 扩展名
import { sum } from './utils.js'
import App from './App.js'
import { config } from '../config.js'

// 错误 — 浏览器会报 404
import { sum } from './utils'
import App from './App'
```

This is worth keeping in mind during development; Node.js behaves the same way.

### 5. The Bare Module Specifier Problem

Bare specifiers like `import { ref } from 'vue'` don't work directly in the browser, because the browser doesn't know which URL `vue` maps to. Solutions:

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

No Vite, no Webpack — just native ESM + Vue 3:

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

Opening the HTML directly via the `file://` protocol won't work, due to CORS restrictions on ES Modules:

```bash
# 方案一：Python
python3 -m http.server 8080

# 方案二：Node.js
npx serve .

# 方案三：live-server（带热重载）
npx live-server .
```

## Performance Considerations

Native ESM has advantages in development, but you should be cautious in production:

```html
<!-- 问题：每个 import 都是一个独立的 HTTP 请求 -->
<script type="module" src="/src/main.js"></script>
<!-- main.js import 了 App.js
     App.js import 了 TodoList.js 和 TodoInput.js
     TodoList.js import 了 Vue 的 h 函数
     ... 可能产生几十甚至上百个请求 -->
```

For small projects, prototypes, and demo pages, native ESM is more than enough. For production projects, it's still best to bundle with Vite or Webpack — Vite uses native ESM in development and Rollup for the build, which is currently the best compromise.

## Dynamic import

Browsers natively support dynamic `import()`, enabling on-demand loading:

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

- Native browser ESM is now fully supported by all major browsers
- `type="module"` is strict-mode, deferred, and scope-isolated by default
- Imports must include the full file extension; bare specifiers need import maps or URL mapping
- Local development requires a static file server; `file://` won't work
- Small projects and prototypes can use native ESM directly, with no bundler needed
- For production projects, Vite is recommended — native ESM in development, bundling for the build
