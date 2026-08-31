---
title: "Svelte Reactivity: Basic Syntax Explained"
date: 2019-09-02 14:58:08
tags:
  - React
readingTime: 4
description: "Svelte is a brand-new frontend compiling framework. Unlike React and Vue, it has no virtual DOM—it compiles components into efficient imperative code at build time. Svelte's reactivity is based on compile-time assignment tracking, and its syntax is extremely concise. Svelte 3 was officially released in 2019; this article takes you deep into its reactivity model and core syntax."
wordCount: 412
---

Svelte is a brand-new frontend compiling framework. Unlike React and Vue, it has no virtual DOM—it compiles components into efficient imperative code at build time. Svelte's reactivity is based on compile-time assignment tracking, and its syntax is extremely concise. Svelte 3 was officially released in 2019; this article takes you deep into its reactivity model and core syntax.

## Svelte's Core Philosophy

React and Vue maintain a virtual DOM at runtime and compute the minimal update via a diffing algorithm. Svelte takes a completely different approach: it analyzes a component's dependencies at compile time and generates code that manipulates the real DOM directly.

This means:
- No virtual DOM overhead
- Less runtime code (smaller bundle)
- Reactivity needs no special runtime library

## Variable Declaration Is Reactive

In Svelte, an ordinary variable assignment is reactive:

```svelte
<script>
  let count = 0;

  function increment() {
    count += 1; // 直接赋值，自动触发视图更新
  }
</script>

<button on:click={increment}>
  点击了 {count} 次
</button>
```

The compiled code looks roughly like this (simplified):

```js
function create_fragment(ctx) {
  let button;

  return {
    c() {
      button = element("button");
      button.textContent = `点击了 ${ctx.count} 次`;
    },
    m(target, anchor) {
      insert(target, button, anchor);
    },
    p(ctx, dirty) {
      if (dirty & 1) {
        set_data(button, `点击了 ${ctx.count} 次`);
      }
    },
    d(detaching) {
      if (detaching) detach(button);
    }
  };
}
```

Svelte already knows at compile time that a change to `count` affects the button's text, so it generates precise DOM-update code.

## Reactive Declarations with $

Statements marked with `$:` are reactive declarations—they re-run automatically when their dependent variables change:

```svelte
<script>
  let width = 100;
  let height = 50;

  // 响应式声明：当 width 或 height 变化时重新计算
  $: area = width * height;
  $: perimeter = 2 * (width + height);

  // 响应式语句：更复杂的逻辑
  $: {
    console.log(`面积变为: ${area}`);
    if (area > 10000) {
      console.log('面积已经超过 10000！');
    }
  }

  // 条件响应式
  $: if (area > 5000) {
    console.log('面积已经超过 5000');
  }
</script>

<input type="number" bind:value={width} />
<input type="number" bind:value={height} />
<p>面积: {area}</p>
<p>周长: {perimeter}</p>
```

### Dependency Tracking in Reactive Declarations

Svelte's reactive declarations determine dependencies through static analysis:

```svelte
<script>
  let items = [1, 2, 3];

  // 只在 items 引用变化时重新计算
  $: total = items.reduce((a, b) => a + b, 0);

  function addItem() {
    // 直接 push 不会触发响应式更新
    // items.push(4); // 不会更新 total！

    // 必须重新赋值
    items = [...items, 4]; // 这样才会触发更新
  }

  function addItemCorrect() {
    items.push(4);
    items = items; // 触发响应式更新的常见技巧
  }
</script>

<button on:click={addItemCorrect}>添加</button>
<p>总和: {total}</p>
```

## Reactivity for Arrays and Objects

Svelte's reactivity is based on assignment operations, which means mutating an array or object won't automatically trigger an update:

```svelte
<script>
  let user = { name: '张三', age: 25 };
  let hobbies = ['coding', 'reading'];

  // 修改对象属性 —— 不会触发更新
  function wrongUpdate() {
    user.age = 26; // 不会更新视图
  }

  // 正确方式：重新赋值
  function correctUpdate() {
    user = { ...user, age: 26 }; // 触发更新
  }

  // 或者使用 "user = user" 技巧
  function alsoCorrect() {
    user.age = 26;
    user = user; // 触发更新
  }

  // 数组同理
  function addHobby() {
    hobbies = [...hobbies, 'gaming'];
  }

  function removeHobby(index) {
    hobbies = hobbies.filter((_, i) => i !== index);
  }
</script>

<p>{user.name} - {user.age}岁</p>
<button on:click={correctUpdate}>增加年龄</button>

<ul>
  {#each hobbies as hobby}
    <li>{hobby}</li>
  {/each}
</ul>
<button on:click={addHobby}>添加爱好</button>
```

## Managing Cross-Component State with store

Svelte provides `writable` and `readable` stores to manage global state:

```js
// stores/counter.js
import { writable, derived } from 'svelte/store';

// writable store
export const count = writable(0);

// derived store：依赖其他 store 的值
export const doubled = derived(count, $count => $count * 2);

export const message = derived(
  count,
  $count => $count > 10 ? '太多了！' : '继续加油'
);

// 自定义 store（封装逻辑）
function createCounter() {
  const { subscribe, set, update } = writable(0);

  return {
    subscribe,
    increment: () => update(n => n + 1),
    decrement: () => update(n => n - 1),
    reset: () => set(0),
  };
}

export const counter = createCounter();
```

Using the store in a component:

```svelte
<script>
  import { count, doubled, message, counter } from './stores/counter.js';
</script>

<!-- 使用 $ 前缀自动订阅和取消订阅 -->
<p>计数: {$count}</p>
<p>双倍: {$doubled}</p>
<p>{$message}</p>

<button on:click={() => $count++}>+1</button>

<!-- 使用自定义 store -->
<button on:click={counter.increment}>+1</button>
<button on:click={counter.decrement}>-1</button>
<button on:click={counter.reset}>重置</button>
```

`$count` is Svelte's syntactic sugar, equivalent to manually subscribing:

```svelte
<script>
  import { count } from './stores/counter.js';

  let countValue;
  count.subscribe(value => countValue = value);
  // $count 自动完成这个过程并在组件销毁时取消订阅
</script>
```

## Two-Way Binding with bind

Svelte has built-in, concise two-way binding syntax:

```svelte
<script>
  let name = '张三';
  let age = 25;
  let agreed = false;
  let color = 'red';
  let volume = 50;
</script>

<!-- 文本输入 -->
<input bind:value={name} />
<p>你好，{name}</p>

<!-- 数字输入 -->
<input type="number" bind:value={age} />

<!-- 复选框 -->
<input type="checkbox" bind:checked={agreed} />

<!-- 选择框 -->
<select bind:value={color}>
  <option value="red">红色</option>
  <option value="green">绿色</option>
  <option value="blue">蓝色</option>
</select>

<!-- 范围滑块 -->
<input type="range" bind:value={volume} min="0" max="100" />

<!-- 分组绑定 -->
<input type="radio" bind:group={color} value="red" /> 红
<input type="radio" bind:group={color} value="green" /> 绿
<input type="radio" bind:group={color} value="blue" /> 蓝
```

## Component Lifecycle

```svelte
<script>
  import { onMount, onDestroy, beforeUpdate, afterUpdate } from 'svelte';

  onMount(() => {
    console.log('组件挂载完成');
    // onMount 可以返回一个清理函数
    const timer = setInterval(() => console.log('tick'), 1000);
    return () => clearInterval(timer);
  });

  onDestroy(() => {
    console.log('组件即将销毁');
  });

  beforeUpdate(() => {
    console.log('DOM 即将更新');
  });

  afterUpdate(() => {
    console.log('DOM 已更新');
  });
</script>
```

## Svelte vs React/Vue Comparison

| Dimension | Svelte | React | Vue |
|-----------|--------|-------|-----|
| Compile / runtime | Pure compile | Runtime + virtual DOM | Runtime + virtual DOM |
| Reactivity | Compile-time assignment tracking | Manual setState/hooks | Object.defineProperty |
| Bundle size | Very small (no framework runtime) | Larger | Medium |
| Syntax | `.svelte` single-file | JSX | `.vue` single-file |
| Learning curve | Low | Medium | Medium |
| Ecosystem | Smaller | Largest | Large |
| Best for | Small apps, embedded components | Large SPAs | Large SPAs |

## Summary

- Svelte's reactivity is based on compile-time assignment tracking—an ordinary variable assignment triggers a view update.
- The `$:` marker declares a reactive statement that automatically tracks its dependent variables.
- Mutating arrays and objects requires reassignment to trigger a reactive update, or you can use the `obj = obj` trick.
- `writable` and `derived` stores provide cross-component state management.
- The `$store` sugar automatically handles subscribing and unsubscribing.
- `bind:` provides concise two-way binding syntax.
- Svelte fits scenarios that demand extreme performance and minimal bundle size, but its ecosystem isn't as mature as React's or Vue's.
