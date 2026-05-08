---
title: "Svelte 入门：编译时框架与响应式原理"
date: 2020-04-25 09:58:21
tags:
  - Svelte
---

Svelte 3 在 2019 年发布后引发了不小的关注。它的核心主张是：**框架应该在编译时完成工作，而不是在运行时**。这意味着 Svelte 没有虚拟 DOM，没有运行时框架代码，生成的产物是原生 DOM 操作的 JavaScript。

## 和 React/Vue 的根本区别

```
React/Vue 的工作流程：
用户代码 → 框架运行时（虚拟 DOM diff）→ DOM 更新

Svelte 的工作流程：
用户代码 → 编译器（生成高效的 DOM 操作代码）→ 纯 JS → DOM 更新
```

结果：Svelte 应用的 bundle 里没有框架运行时，Hello World 的 gzip 体积约 1.6KB。

## 基础语法

Svelte 组件是 `.svelte` 文件，结构类似 Vue 单文件组件：

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0;

  function increment() {
    count++;
  }

  // 响应式声明：$: 开头，依赖变化时自动重新计算
  $: doubled = count * 2;
  $: {
    console.log(`count changed to ${count}`);
  }
</script>

<button on:click={increment}>
  点击了 {count} 次（doubled: {doubled}）
</button>

<style>
  button {
    /* 样式自动 scoped，不会泄漏 */
    background: #ff3e00;
    color: white;
  }
</style>
```

## 响应式系统

Svelte 的响应式基于**赋值**触发，而不是 setter 或 Proxy：

```svelte
<script>
  let arr = [1, 2, 3];
  let obj = { name: 'Alice' };

  function addItem() {
    arr = [...arr, arr.length + 1];  // ✅ 赋值触发更新
    // arr.push(4);                  // ❌ 不触发更新（没有赋值）
  }

  function updateName() {
    obj.name = 'Bob';  // ✅ 对象属性赋值也会触发（Svelte 特殊处理）
  }
</script>
```

## Props 和事件

```svelte
<!-- Child.svelte -->
<script>
  export let name;        // export 声明 prop
  export let age = 18;    // 默认值

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('greet', { message: `Hello, ${name}!` });
  }
</script>

<button on:click={handleClick}>问候 {name}</button>

<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';

  function handleGreet(event) {
    alert(event.detail.message);
  }
</script>

<Child name="Alice" age={25} on:greet={handleGreet} />
```

## Store（状态管理）

```javascript
// stores.js
import { writable, derived } from "svelte/store";

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);

// 组件里使用 $ 前缀自动订阅和取消订阅
```

```svelte
<script>
  import { count, doubled } from './stores.js';
</script>

<p>Count: {$count}, Doubled: {$doubled}</p>
<button on:click={() => $count++}>+1</button>
```

## 编译后的代码

Svelte 的响应式赋值 `count++` 在编译后变成：

```javascript
// 编译后（简化）
function increment() {
  $$invalidate(0, count++, count); // 直接标记需要更新
}
```

没有虚拟 DOM diff，直接操作 DOM，性能基准测试中名列前茅。

## 适用场景

- 追求极致包体积（嵌入式、低端设备）
- 独立小组件/Widget 嵌入非 SPA 页面
- 快速原型开发（语法简洁，上手快）

不太适合：超大型团队项目（TypeScript 支持相比 Angular 较弱）、需要丰富生态（Angular Material、Ant Design 这类成熟 UI 库目前 Svelte 版本较少）。

## 总结

Svelte 不是要取代 React 或 Vue，而是提供了一种不同的思路：**把框架复杂度从运行时转移到编译时**。哪怕你的主力框架不是 Svelte，理解它的设计思路也对你理解前端框架的本质很有帮助。
