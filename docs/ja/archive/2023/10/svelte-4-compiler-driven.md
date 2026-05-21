---
title: "Svelte 4：コンパイラ駆動フロントエンドフレームワークの哲学"
date: 2023-10-22 09:48:15
tags:
  - Svelte
readingTime: 2
description: "Svelte 4 发布了，同时 Svelte 5 Runes 提案也已公开。聊聊 Svelte 的设计哲学，以及它和 React/Vue 的根本区别。"
wordCount: 520
---

Svelte 4 发布了，同时 Svelte 5 Runes 提案也已公开。聊聊 Svelte 的设计哲学，以及它和 React/Vue 的根本区别。

## コンパイル時 vs 実行時

React 和 Vue 的核心是运行时框架。组件编译后仍然是框架的运行时代码在驱动更新。

Svelte 的思路不同：编译器在构建时把组件变成原生的 DOM 操作指令，没有虚拟 DOM diff，没有运行时框架开销。

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0;

  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  点击了 {count} 次
</button>
```

编译后的输出（简化）：

```javascript
// Svelte 编译器生成的代码
function create_fragment(ctx) {
  let button;

  return {
    c() {
      button = element("button");
      button.textContent = `点击了 ${ctx[0]} 次`;
    },
    m(target, anchor) {
      insert(target, button, anchor);
      listen(button, "click", ctx[1]);
    },
    p(ctx, dirty) {
      if (dirty & 1) set_data(button, `点击了 ${ctx[0]} 次`);
    },
    d(detaching) {
      if (detaching) detach(button);
    },
  };
}
```

生成的是直接的 DOM 操作，不是虚拟 DOM diff。这就是 Svelte bundle 小、运行快的根本原因。

## リアクティビティ

```svelte
<script>
  let count = 0;
  let doubled = count * 2; // 不是响应式的！

  // Svelte 4: 用 $: 声明响应式语句
  $: doubled = count * 2;
  $: console.log(`count 变为 ${count}`);

  // 响应式语句也支持块
  $: {
    if (count > 10) {
      console.log("计数超过 10");
    }
  }
</script>
```

`$:` 是 Svelte 4 的响应式机制。编译器分析依赖关系，在赋值时自动生成更新代码。但这个语法有些隐晦，Svelte 5 Runes 用 `$state` 和 `$derived` 替代。

## コンポーネント通信

```svelte
<!-- Child.svelte -->
<script>
  import { createEventDispatcher } from "svelte";

  export let name; // props
  export let count = 0; // 带默认值的 prop

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch("change", { count: count + 1 });
  }
</script>

<p>你好，{name}</p>
<button on:click={handleClick}>增加</button>
```

```svelte
<!-- Parent.svelte -->
<script>
  import Child from "./Child.svelte";

  let totalCount = 0;
</script>

<Child
  name="张三"
  count={totalCount}
  on:change={(e) => totalCount = e.detail.count}
/>
```

## Svelte 5 Runes プレビュー

```svelte
<!-- Svelte 5 新语法 -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log(`count is ${count}`);
    // 可以返回清理函数
    return () => console.log("cleanup");
  });
</script>

<button onclick={() => count++}>
  {count} * 2 = {doubled}
</button>
```

Runes 用函数调用替代了 `$:` 隐式语法，响应式关系更显式、更可预测。

## パフォーマンスデータ

TodoMVC 基准测试（Chrome 118, M2 MacBook）：

```
Svelte 4:   bundle 3.2KB, 创建 1000 行 12ms
React 18:   bundle 44KB,  创建 1000 行 18ms
Vue 3:      bundle 33KB,  创建 1000 行 15ms
```

Svelte 的 bundle 体积优势在小项目上非常明显。运行时性能差异在实际项目中不那么大，但 Svelte 确实更快。

## いつ Svelte を選ぶか

- 对 bundle 体积极度敏感的场景（嵌入式 widget、landing page）
- 团队规模小、不想引入复杂的状态管理
- 喜欢简洁的模板语法

**不推荐的场景：**
- 大型团队协作（生态和工具链不如 React/Vue 成熟）
- 需要丰富的第三方组件库
- 已有 React/Vue 技术栈的项目

## まとめ

- Svelte 是编译时框架，没有虚拟 DOM 运行时开销
- Bundle 体积远小于 React/Vue，适合对体积敏感的场景
- `$:` 响应式语法有隐晦之处，Svelte 5 Runes 是改进方向
- 生态系统在成长但远不如 React/Vue 丰富
- 适合新项目和小团队，不适合大型企业级应用的全栈替换