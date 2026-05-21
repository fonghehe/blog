---
title: "Svelte 5 Runes：響應式編程的範式轉變"
date: 2024-10-12 10:00:00
tags:
  - Svelte
readingTime: 2
description: "Svelte 5 在 2024 年 10 月正式發佈，最核心的變化是引入了 Runes 系統。這是一個對響應式編程模型的根本性重構。從架構師視角分析一下這個變化的意義。"
wordCount: 392
---

Svelte 5 在 2024 年 10 月正式發佈，最核心的變化是引入了 Runes 系統。這是一個對響應式編程模型的根本性重構。從架構師視角分析一下這個變化的意義。

## 從隱式到顯式

Svelte 4 的響應式是隱式的——賦值即觸發更新：

```svelte
<!-- Svelte 4 -->
<script>
  let count = 0;

  function increment() {
    count += 1; // 隱式觸發更新
  }
</script>

<button on:click={increment}>{count}</button>
```

這種方式簡潔，但在複雜場景下有侷限：跨文件共享狀態、派生計算、副作用管理都需要額外的機制（stores、$ 語法糖）。

Svelte 5 引入 Runes，響應式變為顯式聲明：

```svelte
<!-- Svelte 5 -->
<script>
  let count = $state(0);

  function increment() {
    count += 1; // 仍然是響應式的，但明確通過 $state 聲明
  }
</script>

<button onclick={increment}>{count}</button>
```

## 核心 Runes

### $state — 響應式狀態

```typescript
// 簡單值
let name = $state("張三");

// 對象自動深度響應
let user = $state({
  name: "張三",
  preferences: { theme: "dark" },
});

// 修改嵌套屬性也自動響應
user.preferences.theme = "light";
```

### $derived — 派生值

替代 Svelte 4 的 `$:` 響應式聲明：

```typescript
// Svelte 4
$: doubled = count * 2;
$: fullName = `${firstName} ${lastName}`;

// Svelte 5
const doubled = $derived(count * 2);
const fullName = $derived(`${firstName} ${lastName}`);

// 複雜派生
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
  // 訪問 count 時自動建立依賴
  console.log(`count is ${count}`);

  // 返回清理函數
  return () => {
    console.log("cleanup");
  };
});

// 只運行一次（類似 onMount）
$effect(() => {
  initAnalytics();
  return () => cleanupAnalytics();
}, []);
```

### $props — 組件屬性

```typescript
// Svelte 4
export let name = "default";
export let count;

// Svelte 5
let { name = "default", count, onsubmit }: Props = $props();

// 解構 + 重命名
let { items: list = [] }: { items: string[] } = $props();
```

## 跨組件狀態共享

不再需要單獨的 store 模塊：

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

// 組件中使用
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

## 和其他框架的對比

```
React：  useState/useMemo/useCallback — 函數式 + hooks 規則
Vue：    ref/computed/watch — 組合式 API
Svelte： $state/$derived/$effect — Runes 系統
```

Runes 的優勢在於：沒有 hooks 的規則限制（不能在條件語句中使用），沒有 ref 的 `.value` 煩惱。

## TypeScript 集成

```typescript
// 類型定義
interface User {
  name: string;
  email: string;
  role: "admin" | "user";
}

// $state 自動推斷類型
let user = $state<User>({
  name: "張三",
  email: "zhang@example.com",
  role: "admin",
});

// $props 類型
interface Props {
  title: string;
  items: User[];
  onSelect: (user: User) => void;
}

let { title, items, onSelect }: Props = $props();
```

## 遷移建議

Svelte 5 完全向後兼容 Svelte 4 語法，可以漸進遷移：

1. 新組件用 Runes 寫法
2. 簡單組件逐步改寫（$state, $derived）
3. store 邏輯遷移到 $state 函數
4. 最後處理複雜的 $: 語句

## 小結

- Runes 讓 Svelte 的響應式從隱式變為顯式，可預測性更好
- `$state` / `$derived` / `$effect` 覆蓋狀態、派生、副作用三大場景
- 跨組件狀態共享不再需要單獨的 store 機制
- 完全向後兼容，支持漸進遷移
- TypeScript 集成度高，類型推斷自然
