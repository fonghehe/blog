---
title: "Svelte 入門：編譯時框架與響應式原理"
date: 2020-04-25 09:58:21
tags:
  - Svelte
readingTime: 2
description: "Svelte 3 在 2019 年發佈後引發了不小的關注。它的核心主張是：**框架應該在編譯時完成工作，而不是在運行時**。這意味着 Svelte 沒有虛擬 DOM，沒有運行時框架代碼，生成的產物是原生 DOM 操作的 JavaScript。"
wordCount: 364
---

Svelte 3 在 2019 年發佈後引發了不小的關注。它的核心主張是：**框架應該在編譯時完成工作，而不是在運行時**。這意味着 Svelte 沒有虛擬 DOM，沒有運行時框架代碼，生成的產物是原生 DOM 操作的 JavaScript。

## 和 React/Vue 的根本區別

```
React/Vue 的工作流程：
用户代碼 → 框架運行時（虛擬 DOM diff）→ DOM 更新

Svelte 的工作流程：
用户代碼 → 編譯器（生成高效的 DOM 操作代碼）→ 純 JS → DOM 更新
```

結果：Svelte 應用的 bundle 裏沒有框架運行時，Hello World 的 gzip 體積約 1.6KB。

## 基礎語法

Svelte 組件是 `.svelte` 文件，結構類似 Vue 單文件組件：

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0;

  function increment() {
    count++;
  }

  // 響應式聲明：$: 開頭，依賴變化時自動重新計算
  $: doubled = count * 2;
  $: {
    console.log(`count changed to ${count}`);
  }
</script>

<button on:click={increment}>
  點擊了 {count} 次（doubled: {doubled}）
</button>

<style>
  button {
    /* 樣式自動 scoped，不會泄漏 */
    background: #ff3e00;
    color: white;
  }
</style>
```

## 響應式系統

Svelte 的響應式基於**賦值**觸發，而不是 setter 或 Proxy：

```svelte
<script>
  let arr = [1, 2, 3];
  let obj = { name: 'Alice' };

  function addItem() {
    arr = [...arr, arr.length + 1];  // ✅ 賦值觸發更新
    // arr.push(4);                  // ❌ 不觸發更新（沒有賦值）
  }

  function updateName() {
    obj.name = 'Bob';  // ✅ 對象屬性賦值也會觸發（Svelte 特殊處理）
  }
</script>
```

## Props 和事件

```svelte
<!-- Child.svelte -->
<script>
  export let name;        // export 聲明 prop
  export let age = 18;    // 默認值

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('greet', { message: `Hello, ${name}!` });
  }
</script>

<button on:click={handleClick}>問候 {name}</button>

<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';

  function handleGreet(event) {
    alert(event.detail.message);
  }
</script>

<Child name="Alice" age={25} on:greet={handleGreet} />
```

## Store（狀態管理）

```javascript
// stores.js
import { writable, derived } from "svelte/store";

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);

// 組件裏使用 $ 前綴自動訂閲和取消訂閲
```

```svelte
<script>
  import { count, doubled } from './stores.js';
</script>

<p>Count: {$count}, Doubled: {$doubled}</p>
<button on:click={() => $count++}>+1</button>
```

## 編譯後的代碼

Svelte 的響應式賦值 `count++` 在編譯後變成：

```javascript
// 編譯後（簡化）
function increment() {
  $$invalidate(0, count++, count); // 直接標記需要更新
}
```

沒有虛擬 DOM diff，直接操作 DOM，性能基準測試中名列前茅。

## 適用場景

- 追求極致包體積（嵌入式、低端設備）
- 獨立小組件/Widget 嵌入非 SPA 頁面
- 快速原型開發（語法簡潔，上手快）

不太適合：超大型團隊項目（TypeScript 支援相比 Angular 較弱）、需要豐富生態（Angular Material、Ant Design 這類成熟 UI 庫目前 Svelte 版本較少）。

## 總結

Svelte 不是要取代 React 或 Vue，而是提供了一種不同的思路：**把框架複雜度從運行時轉移到編譯時**。哪怕你的主力框架不是 Svelte，理解它的設計思路也對你理解前端框架的本質很有幫助。
