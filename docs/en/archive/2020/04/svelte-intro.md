---
title: "Svelte Introduction: Compile-Time Framework and Reactive Principles"
date: 2020-04-25 09:58:21
tags:
  - Svelte
readingTime: 2
description: "Svelte 3 drew considerable attention after its 2019 release. Its core thesis is that **the framework should do its work at compile time, not at runtime**. That means no virtual DOM and no runtime framework code—the output is plain JavaScript that manipulates the native DOM."
wordCount: 237
---

Svelte 3, released in 2019, drew considerable attention. Its core claim is that **the framework should do its work at compile time, not at runtime**. That means Svelte has no virtual DOM and no runtime framework code — its output is plain JavaScript that manipulates the native DOM.

## Fundamental Differences from React/Vue

```
React/Vue 的工作流程：
用户代码 → 框架运行时（虚拟 DOM diff）→ DOM 更新

Svelte 的工作流程：
用户代码 → 编译器（生成高效的 DOM 操作代码）→ 纯 JS → DOM 更新
```

The result: a Svelte app's bundle carries no framework runtime, and a Hello World gzips to roughly 1.6 KB.

## Basic Syntax

A Svelte component is a `.svelte` file whose structure resembles a Vue single-file component:

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

## Reactivity System

Svelte's reactivity is triggered by **assignment**, not by setters or Proxies:

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

## Props and Events

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

## Store (State Management)

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

## Compiled Output

Svelte's reactive assignment `count++` compiles down to:

```javascript
// 编译后（简化）
function increment() {
  $$invalidate(0, count++, count); // 直接标记需要更新
}
```

With no virtual DOM diffing and direct DOM manipulation, Svelte ranks at the top of performance benchmarks.

## When to Use It

- When you need minimal bundle size (embedded devices, low-end hardware)
- Embedding standalone widgets into non-SPA pages
- Rapid prototyping (concise syntax, gentle learning curve)

Less suitable for: very large team projects (Svelte's TypeScript support is weaker than Angular's), or when you need a rich ecosystem (mature UI libraries like Angular Material or Ant Design have few Svelte equivalents at the moment).

## Summary

Svelte isn't meant to replace React or Vue; it offers a different approach: **shift framework complexity from runtime to compile time**. Even if Svelte isn't your main framework, understanding its design helps you grasp what frontend frameworks are fundamentally about.
