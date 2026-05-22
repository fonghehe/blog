---
title: "Svelte 5 穩定版：全面擁抱 Runes"
date: 2025-11-08 14:42:19
tags:
  - Svelte
readingTime: 2
description: "Svelte 5 穩定版已經發布一段時間了，Runes 系統是最大的變化。來對比一下 Svelte 4 和 Svelte 5 的寫法差異。"
wordCount: 170
---

Svelte 5 穩定版已經發布一段時間了，Runes 系統是最大的變化。來對比一下 Svelte 4 和 Svelte 5 的寫法差異。

## Runes 是什麼

```
Runes = Svelte 5 的響應式原語
類似 Vue 的 ref/reactive，但語法更簡潔

核心 Runes：
  $state       → 響應式狀態
  $derived     → 派生狀態（計算屬性）
  $effect      → 副作用
  $props       → 組件屬性
  $bindable    → 可綁定屬性
  $inspect     → 調試用
```

## $state：響應式狀態

```svelte
<!-- Svelte 4 -->
<script>
  let count = 0;
  let user = { name: "張三", age: 25 };

  function increment() {
    count += 1; // 直接賦值觸發更新
  }

  function updateUser() {
    user.age += 1; // 巢狀屬性需要特殊處理
    user = user;   // 手動觸發更新
  }
</script>

<!-- Svelte 5 -->
<script>
  let count = $state(0);
  let user = $state({ name: "張三", age: 25 });

  function increment() {
    count += 1; // 自動響應
  }

  function updateUser() {
    user.age += 1; // 深層響應式，自動觸發更新
  }
</script>
```

## $derived：派生狀態

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

  // 帶副作用的派生
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
    console.log("count 變了:", count);
    document.title = `點擊了 ${count} 次`;
  }

  $: if (count > 10) {
    console.log("太多了!");
  }
</script>

<!-- Svelte 5 -->
<script>
  let count = $state(0);

  $effect(() => {
    console.log("count 變了:", count);
    document.title = `點擊了 ${count} 次`;

    // cleanup 函數
    return () => {
      console.log("effect 清理");
    };
  });

  // 隻在特定時機運行
  $effect.pre(() => {
    // DOM 更新前運行
    console.log("即將更新 DOM");
  });
</script>
```

## $props：組件屬性

```svelte
<!-- Svelte 4 -->
<script>
  export let name;
  export let age = 25;
  export let className = "";

  // $$restProps 處理剩餘屬性
</script>

<div class={className} {...$$restProps}>
  {name}, {age}歲
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
  {name}, {age}歲
</div>
```

## $bindable：雙向綁定

```svelte
<!-- 子組件 Input.svelte -->
<script>
  let { value = $bindable(""), placeholder = "請輸入" } = $props<{
    value?: string;
    placeholder?: string;
  }>();
</script>

<input bind:value {placeholder} />

<!-- 父組件 -->
<script>
  let searchQuery = $state("");
</script>

<Input bind:value={searchQuery} />
<p>搜索：{searchQuery}</p>
```

## 組件事件 vs 回調

```svelte
<!-- Svelte 4：使用 createEventDispatcher -->
<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch("select", { id: 1 });
  }
</script>

<button on:click={handleClick}>選擇</button>

<!-- S�velte 5：直接用回調函數 -->
<script>
  let { onSelect } = $props<{
    onSelect?: (data: { id: number }) => void;
  }>();
</script>

<button onclick={() => onSelect?.({ id: 1 })}>選擇</button>

<!-- 父組件 -->
<script>
  function handleSelect(data: { id: number }) {
    console.log("選中:", data.id);
  }
</script>

<MyComponent onSelect={handleSelect} />
<!-- 不再需要 on: 語法 -->
```

## 與 React/Vue 的對比

```
概念對比：

              React 19      Vue 3.5       Svelte 5
──────────────────────────────────────────────────────
狀態          useState      ref()         $state()
派生          useMemo       computed()    $derived()
副作用        useEffect     watch()       $effect()
屬性          props         defineProps   $props()
雙向綁定      -             v-model       $bindable()

語法簡潔度：Svelte > Vue > React
類型安全：  Svelte ≈ Vue > React
生態成熟度：React > Vue > Svelte
```

## 遷移策略

```
Svelte 4 → 5 遷移：

1. 漸進式遷移：Svelte 5 向後兼容 Svelte 4 語法
2. 自動遷移工具：npx sv migrate svelte-5
3. 優先遷移：新組件用 Svelte 5 寫法
4. 後續遷移：逐步改造老組件
```

## 小結

- Svelte 5 的 Runes 系統讓響應式更顯式、更可預測
- $state、$derived、$effect 三件套覆蓋了大部分場景
- $props 替代 export let，類型安全更好
- 回調替代 createEventDispatcher，API 更簡潔
- Svelte 5 向後兼容，可以漸進式遷移
- 對於小型項目和性能敏感場景，Svelte 依然是好選擇
