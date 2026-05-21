---
title: "Svelte 5 Runes：响应式编程的范式转变"
date: 2024-10-12 10:00:00
tags:
  - Svelte
readingTime: 2
description: "Svelte 5 在 2024 年 10 月正式发布，最核心的变化是引入了 Runes 系统。这是一个对响应式编程模型的根本性重构。从架构师视角分析一下这个变化的意义。"
wordCount: 392
---

Svelte 5 在 2024 年 10 月正式发布，最核心的变化是引入了 Runes 系统。这是一个对响应式编程模型的根本性重构。从架构师视角分析一下这个变化的意义。

## 从隐式到显式

Svelte 4 的响应式是隐式的——赋值即触发更新：

```svelte
<!-- Svelte 4 -->
<script>
  let count = 0;

  function increment() {
    count += 1; // 隐式触发更新
  }
</script>

<button on:click={increment}>{count}</button>
```

这种方式简洁，但在复杂场景下有局限：跨文件共享状态、派生计算、副作用管理都需要额外的机制（stores、$ 语法糖）。

Svelte 5 引入 Runes，响应式变为显式声明：

```svelte
<!-- Svelte 5 -->
<script>
  let count = $state(0);

  function increment() {
    count += 1; // 仍然是响应式的，但明确通过 $state 声明
  }
</script>

<button onclick={increment}>{count}</button>
```

## 核心 Runes

### $state — 响应式状态

```typescript
// 简单值
let name = $state("张三");

// 对象自动深度响应
let user = $state({
  name: "张三",
  preferences: { theme: "dark" },
});

// 修改嵌套属性也自动响应
user.preferences.theme = "light";
```

### $derived — 派生值

替代 Svelte 4 的 `$:` 响应式声明：

```typescript
// Svelte 4
$: doubled = count * 2;
$: fullName = `${firstName} ${lastName}`;

// Svelte 5
const doubled = $derived(count * 2);
const fullName = $derived(`${firstName} ${lastName}`);

// 复杂派生
const stats = $derived.by(() => {
  const active = users.filter((u) => u.isActive);
  return {
    total: active.length,
    avgScore: active.reduce((s, u) => s + u.score, 0) / active.length,
  };
});
```

### $effect — 副作用

```typescript
// 替代 $: 和 onMount 的副作用
$effect(() => {
  // 访问 count 时自动建立依赖
  console.log(`count is ${count}`);

  // 返回清理函数
  return () => {
    console.log("cleanup");
  };
});

// 只运行一次（类似 onMount）
$effect(() => {
  initAnalytics();
  return () => cleanupAnalytics();
}, []);
```

### $props — 组件属性

```typescript
// Svelte 4
export let name = "default";
export let count;

// Svelte 5
let { name = "default", count, onsubmit }: Props = $props();

// 解构 + 重命名
let { items: list = [] }: { items: string[] } = $props();
```

## 跨组件状态共享

不再需要单独的 store 模块：

```typescript
// shared-state.ts
export function createCounter(initial = 0) {
  let count = $state(initial);

  return {
    get count() {
      return count;
    },
    increment() {
      count++;
    },
    decrement() {
      count--;
    },
  };
}

// 组件中使用
const counter = createCounter();
```

```svelte
<script>
  import { createCounter } from "./shared-state";

  const counter = createCounter();
</script>

<button onclick={() => counter.increment()}>
  {counter.count}
</button>
```

## 和其他框架的对比

```
React：  useState/useMemo/useCallback — 函数式 + hooks 规则
Vue：    ref/computed/watch — 组合式 API
Svelte： $state/$derived/$effect — Runes 系统
```

Runes 的优势在于：没有 hooks 的规则限制（不能在条件语句中使用），没有 ref 的 `.value` 烦恼。

## TypeScript 集成

```typescript
// 类型定义
interface User {
  name: string;
  email: string;
  role: "admin" | "user";
}

// $state 自动推断类型
let user = $state<User>({
  name: "张三",
  email: "zhang@example.com",
  role: "admin",
});

// $props 类型
interface Props {
  title: string;
  items: User[];
  onSelect: (user: User) => void;
}

let { title, items, onSelect }: Props = $props();
```

## 迁移建议

Svelte 5 完全向后兼容 Svelte 4 语法，可以渐进迁移：

1. 新组件用 Runes 写法
2. 简单组件逐步改写（$state, $derived）
3. store 逻辑迁移到 $state 函数
4. 最后处理复杂的 $: 语句

## 小结

- Runes 让 Svelte 的响应式从隐式变为显式，可预测性更好
- `$state` / `$derived` / `$effect` 覆盖状态、派生、副作用三大场景
- 跨组件状态共享不再需要单独的 store 机制
- 完全向后兼容，支持渐进迁移
- TypeScript 集成度高，类型推断自然
