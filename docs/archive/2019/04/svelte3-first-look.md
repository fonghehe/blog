---
title: "Svelte 初体验：没有 Virtual DOM 的框架"
date: 2019-04-07 10:35:05
tags:
  - Svelte
readingTime: 2
description: "Svelte 3 上周发布了，和 Vue/React 思路完全不同——编译时框架，没有运行时，没有 Virtual DOM。用了一周，说说感受。"
---

Svelte 3 上周发布了，和 Vue/React 思路完全不同——编译时框架，没有运行时，没有 Virtual DOM。用了一周，说说感受。

## 和 Vue/React 最大的区别

Vue/React：运行时框架，需要加载框架代码（~30KB+），在浏览器里做响应式。

Svelte：编译时框架，把 `.svelte` 文件编译成高效的 vanilla JS，打包后几乎没有框架体积。

## Svelte 语法

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0
  let name = 'World'

  // 响应式声明（computed）
  $: doubled = count * 2
  $: console.log('count 变了:', count)  // 响应式副作用

  function increment() {
    count += 1
  }
</script>

<!-- 模板 -->
<h1>Hello {name}!</h1>
<p>Count: {count}, Doubled: {doubled}</p>
<button on:click={increment}>+1</button>

<!-- 条件和循环 -->
{#if count > 10}
  <p>大于 10 了！</p>
{:else if count > 5}
  <p>超过一半了</p>
{:else}
  <p>继续加油</p>
{/if}

{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}

<style>
  /* 样式自动 scope！ */
  button { background: blue; color: white; }
</style>
```

## 响应式不需要 this

```svelte
<script>
  let user = { name: 'Alice', age: 25 }

  // 对象赋值触发更新（注意：必须赋值，push 不会触发）
  function birthday() {
    user = { ...user, age: user.age + 1 }  // 或者 user.age += 1
  }

  let todos = []
  function addTodo(text) {
    todos = [...todos, { id: Date.now(), text, done: false }]
    // todos.push(xxx) 不触发更新！
  }
</script>
```

## Store（全局状态）

```javascript
// stores.js
import { writable, derived, readable } from "svelte/store";

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);
export const time = readable(new Date(), (set) => {
  const interval = setInterval(() => set(new Date()), 1000);
  return () => clearInterval(interval);
});
```

```svelte
<script>
  import { count, doubled, time } from './stores'

  // $前缀自动订阅/取消订阅
</script>

<p>Count: {$count}</p>
<p>Doubled: {$doubled}</p>
<p>Time: {$time.toLocaleTimeString()}</p>
<button on:click={() => $count += 1}>+1</button>
```

## 和 React/Vue 比较

|            | Svelte                 | Vue 3    | React    |
| 
---------- | ---------------------- | -------- | -------- |
| 运行时体积 | ~1KB                   | ~22KB    | ~42KB    |
| 学习成本   | 低（贴近原生 HTML/JS） | 中       | 中       |
| 生态       | 弱（2019年还小众）     | 强       | 很强     |
| 大型项目   | 待验证                 | 经过验证 | 经过验证 |

## 我的结论

Svelte 适合：

- 性能极度敏感的场景（嵌入式组件、小工具）
- 个人项目、快速原型

目前不建议用于大型生产项目，主要是生态不够成熟、TypeScript 支持一般（2019年还早）、社区还小。

但它的思路很有启发性，可能代表未来编译时框架的方向。

## 小结

- Svelte 把响应式编译进 JS，不需要运行时，体积极小
- 语法比 Vue/React 更接近原生 HTML
- `$:` 实现响应式声明，`$store` 自动订阅
- 2019年生态还弱，大型项目谨慎使用
