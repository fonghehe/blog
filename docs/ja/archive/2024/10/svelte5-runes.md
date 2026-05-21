---
title: "Svelte 5 Runes：リアクティブプログラミングのパラダイムシフト"
date: 2024-10-12 10:00:00
tags:
  - Svelte
readingTime: 3
description: "Svelte 5 は2024年10月に正式リリースされ、最も核心的な変更は Runes システムの導入です。これはリアクティブプログラミングモデルの根本的な再構築です。アーキテクトの視点からこの変化の意義を分析します。"
wordCount: 526
---

Svelte 5 は2024年10月に正式リリースされ、最も核心的な変更は Runes システムの導入です。これはリアクティブプログラミングモデルの根本的な再構築です。アーキテクトの視点からこの変化の意義を分析します。

## 暗黙から明示へ

Svelte 4 のリアクティビティは暗黙的でした——代入が更新をトリガーします：

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

このアプローチはシンプルですが、複雑なシナリオでは限界があります：ファイルをまたぐ状態共有、派生計算、副作用管理にはすべて追加のメカニズム（stores、$ 構文糖）が必要です。

Svelte 5 は Runes を導入し、リアクティビティが明示的な宣言になりました：

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

## コア Runes

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

Svelte 4 の `$:` リアクティブ宣言を置き換えます：

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

## コンポーネント間状態共有

別途 store モジュールが不要になりました：

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

## 他フレームワークとの比較

```
React：  useState/useMemo/useCallback — 函数式 + hooks 规则
Vue：    ref/computed/watch — 组合式 API
Svelte： $state/$derived/$effect — Runes 系统
```

Runes の利点：フックのルール制限なし（条件文内で使えない制限がない）、ref の `.value` の煩わしさなし。

## TypeScript 統合

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

## 移行の推奨事項

Svelte 5 は Svelte 4 構文と完全に後方互換性があり、段階的な移行が可能です：

1. 新组件用 Runes 写法
2. 简单组件逐步改写（$state, $derived）
3. store 逻辑迁移到 $state 函数
4. 最后处理复杂的 $: 语句

## まとめ

- Runes 让 Svelte 的响应式从隐式变为显式，可预测性更好
- `$state` / `$derived` / `$effect` 覆盖状态、派生、副作用三大场景
- 跨组件状态共享不再需要单独的 store 机制
- 完全向后兼容，支持渐进迁移
- TypeScript 集成度高，类型推断自然
