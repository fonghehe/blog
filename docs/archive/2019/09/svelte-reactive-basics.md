---
title: "Svelte 响应式基础语法详解"
date: 2019-09-02 14:58:08
tags:
  - React
readingTime: 4
description: "Svelte 是一个全新的前端编译框架，与 React 和 Vue 不同，它没有虚拟 DOM，在编译阶段就将组件转换为高效的命令式代码。Svelte 的响应式系统基于编译时的赋值追踪，语法极其简洁。2019 年 Svelte 3 正式发布，本文将带你深入了解其响应式原理和核心语法。"
wordCount: 718
---

Svelte 是一个全新的前端编译框架，与 React 和 Vue 不同，它没有虚拟 DOM，在编译阶段就将组件转换为高效的命令式代码。Svelte 的响应式系统基于编译时的赋值追踪，语法极其简洁。2019 年 Svelte 3 正式发布，本文将带你深入了解其响应式原理和核心语法。

## Svelte 的核心理念

React 和 Vue 在运行时维护一套虚拟 DOM，通过 diff 算法计算最小更新。Svelte 的思路完全不同：在编译时分析组件的依赖关系，生成直接操作真实 DOM 的代码。

这意味着：
- 没有虚拟 DOM 开销
- 运行时代码更少（bundle 更小）
- 响应式不需要特殊的运行时库

## 变量声明即响应式

在 Svelte 中，普通的变量赋值就是响应式的：

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

编译后的代码大致如下（简化版）：

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

Svelte 在编译时就知道 `count` 变化会影响按钮的文本，因此生成了精准的 DOM 更新代码。

## 响应式声明 $

使用 `$:` 标记的语句是响应式声明，当依赖的变量变化时自动重新执行：

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

### 响应式声明的依赖追踪

Svelte 的响应式声明通过静态分析来确定依赖关系：

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

## 数组和对象的响应式

Svelte 的响应式基于赋值操作，这意味着对数组或对象的修改不会自动触发更新：

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

## 使用 store 管理跨组件状态

Svelte 提供了 writable store 和 readable store 来管理全局状态：

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

在组件中使用 store：

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

`$count` 是 Svelte 的语法糖，等价于手动订阅：

```svelte
<script>
  import { count } from './stores/counter.js';

  let countValue;
  count.subscribe(value => countValue = value);
  // $count 自动完成这个过程并在组件销毁时取消订阅
</script>
```

## bind 双向绑定

Svelte 内置了简洁的双向绑定语法：

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

## 组件生命周期

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

## Svelte 与 React/Vue 对比

| 维度 | Svelte | React | Vue |
|
------|--------|-------|-----|
| 编译/运行时 | 纯编译 | 运行时 + 虚拟 DOM | 运行时 + 虚拟 DOM |
| 响应式 | 编译时赋值追踪 | 手动 setState/hooks | Object.defineProperty |
| 包体积 | 极小（无框架运行时） | 较大 | 中等 |
| 语法 | `.svelte` 单文件 | JSX | `.vue` 单文件 |
| 学习曲线 | 低 | 中 | 中 |
| 生态 | 较小 | 最大 | 大 |
| 适用场景 | 小型应用、嵌入式组件 | 大型 SPA | 大型 SPA |

## 小结

- Svelte 的响应式基于编译时赋值追踪，普通变量赋值即触发视图更新
- `$:` 标记响应式声明，自动追踪依赖的变量
- 数组和对象的修改需要重新赋值才能触发响应式更新，或者使用 `obj = obj` 技巧
- `writable` 和 `derived` store 提供了跨组件状态管理方案
- `$store` 语法糖自动处理订阅和取消订阅
- `bind:` 提供了简洁的双向绑定语法
- Svelte 适合追求极致性能和最小包体积的场景，但生态不如 React 和 Vue 成熟
