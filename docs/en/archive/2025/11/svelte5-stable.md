---
title: "Svelte 5 Stable: Fully Embracing Runes"
date: 2025-11-08 10:00:00
tags:
  - Svelte
readingTime: 2
description: "Svelte 5 稳定版已经发布一段时间了，Runes 系统是最大的变化。来对比一下 Svelte 4 和 Svelte 5 的写法差异。"
wordCount: 169
---

Svelte 5 稳定版已经发布一段时间了，Runes 系统是最大的变化。来对比一下 Svelte 4 和 Svelte 5 的写法差异。

## Runes 是什么

```
Runes = Svelte 5 的响应式原语
类似 Vue 的 ref/reactive，但语法更简洁

核心 Runes：
  $state       → 响应式状态
  $derived     → 派生状态（计算属性）
  $effect      → 副作用
  $props       → 组件属性
  $bindable    → 可绑定属性
  $inspect     → 调试用
```

## $state：响应式状态

```svelte
<!-- Svelte 4 -->
<script>
  let count = 0;
  let user = { name: "张三", age: 25 };

  function increment() {
    count += 1; // 直接赋值触发更新
  }

  function updateUser() {
    user.age += 1; // 嵌套属性需要特殊处理
    user = user;   // 手动触发更新
  }
</script>

<!-- Svelte 5 -->
<script>
  let count = $state(0);
  let user = $state({ name: "张三", age: 25 });

  function increment() {
    count += 1; // 自动响应
  }

  function updateUser() {
    user.age += 1; // 深层响应式，自动触发更新
  }
</script>
```

## $derived：派生状态

```svelte
<!-- Svelte 4 -->
<script>
  let items = [1, 2, 3, 4, 5];
  $: total = items.reduce((a, b) => a + b, 0);
  $: average = total / items.length;
  $: doubled = items.map(n => n * 2);
</script>

<!-- Svelte 5 -->
<script>
  let items = $state([1, 2, 3, 4, 5]);
  const total = $derived(items.reduce((a, b) => a + b, 0));
  const average = $derived(total / items.length);
  const doubled = $derived(items.map(n => n * 2));

  // 带副作用的派生
  let sorted = $derived.by(() => {
    console.log("重新排序");
    return [...items].sort((a, b) => a - b);
  });
</script>
```

## $effect：副作用

```svelte
<!-- Svelte 4 -->
<script>
  let count = 0;

  $: {
    console.log("count 变了:", count);
    document.title = `点击了 ${count} 次`;
  }

  $: if (count > 10) {
    console.log("太多了!");
  }
</script>

<!-- Svelte 5 -->
<script>
  let count = $state(0);

  $effect(() => {
    console.log("count 变了:", count);
    document.title = `点击了 ${count} 次`;

    // cleanup 函数
    return () => {
      console.log("effect 清理");
    };
  });

  // 只在特定时机运行
  $effect.pre(() => {
    // DOM 更新前运行
    console.log("即将更新 DOM");
  });
</script>
```

## $props：组件属性

```svelte
<!-- Svelte 4 -->
<script>
  export let name;
  export let age = 25;
  export let className = "";

  // $$restProps 处理剩余属性
</script>

<div class={className} {...$$restProps}>
  {name}, {age}岁
</div>

<!-- Svelte 5 -->
<script>
  let { name, age = 25, className = "", ...rest } = $props<{
    name: string;
    age?: number;
    className?: string;
  }>();
</script>

<div class={className} {...rest}>
  {name}, {age}岁
</div>
```

## $bindable：双向绑定

```svelte
<!-- 子组件 Input.svelte -->
<script>
  let { value = $bindable(""), placeholder = "请输入" } = $props<{
    value?: string;
    placeholder?: string;
  }>();
</script>

<input bind:value {placeholder} />

<!-- 父组件 -->
<script>
  let searchQuery = $state("");
</script>

<Input bind:value={searchQuery} />
<p>搜索：{searchQuery}</p>
```

## 组件事件 vs 回调

```svelte
<!-- Svelte 4：使用 createEventDispatcher -->
<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch("select", { id: 1 });
  }
</script>

<button on:click={handleClick}>选择</button>

<!-- S�velte 5：直接用回调函数 -->
<script>
  let { onSelect } = $props<{
    onSelect?: (data: { id: number }) => void;
  }>();
</script>

<button onclick={() => onSelect?.({ id: 1 })}>选择</button>

<!-- 父组件 -->
<script>
  function handleSelect(data: { id: number }) {
    console.log("选中:", data.id);
  }
</script>

<MyComponent onSelect={handleSelect} />
<!-- 不再需要 on: 语法 -->
```

## 与 React/Vue 的对比

```
概念对比：

              React 19      Vue 3.5       Svelte 5
──────────────────────────────────────────────────────
状态          useState      ref()         $state()
派生          useMemo       computed()    $derived()
副作用        useEffect     watch()       $effect()
属性          props         defineProps   $props()
双向绑定      -             v-model       $bindable()

语法简洁度：Svelte > Vue > React
类型安全：  Svelte ≈ Vue > React
生态成熟度：React > Vue > Svelte
```

## 迁移策略

```
Svelte 4 → 5 迁移：

1. 渐进式迁移：Svelte 5 向后兼容 Svelte 4 语法
2. 自动迁移工具：npx sv migrate svelte-5
3. 优先迁移：新组件用 Svelte 5 写法
4. 后续迁移：逐步改造老组件
```

## Summary

- Svelte 5 的 Runes 系统让响应式更显式、更可预测
- $state、$derived、$effect 三件套覆盖了大部分场景
- $props 替代 export let，类型安全更好
- 回调替代 createEventDispatcher，API 更简洁
- Svelte 5 向后兼容，可以渐进式迁移
- 对于小型项目和性能敏感场景，Svelte 依然是好选择
