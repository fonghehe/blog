---
title: "Svelte 4：編譯器驅動的前端框架哲學"
date: 2023-10-22 09:48:15
tags:
  - Svelte
readingTime: 2
description: "Svelte 4 釋出了，同時 Svelte 5 Runes 提案也已公開。聊聊 Svelte 的設計哲學，以及它和 React/Vue 的根本區別。"
wordCount: 498
---

Svelte 4 釋出了，同時 Svelte 5 Runes 提案也已公開。聊聊 Svelte 的設計哲學，以及它和 React/Vue 的根本區別。

## 編譯時 vs 執行時

React 和 Vue 的核心是執行時框架。元件編譯後仍然是框架的執行時程式碼在驅動更新。

Svelte 的思路不同：編譯器在構建時把元件變成原生的 DOM 操作指令，沒有虛擬 DOM diff，沒有執行時框架開銷。

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0;

  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  點選了 {count} 次
</button>
```

編譯後的輸出（簡化）：

```javascript
// Svelte 編譯器生成的程式碼
function create_fragment(ctx) {
  let button;

  return {
    c() {
      button = element("button");
      button.textContent = `點選了 ${ctx[0]} 次`;
    },
    m(target, anchor) {
      insert(target, button, anchor);
      listen(button, "click", ctx[1]);
    },
    p(ctx, dirty) {
      if (dirty & 1) set_data(button, `點選了 ${ctx[0]} 次`);
    },
    d(detaching) {
      if (detaching) detach(button);
    },
  };
}
```

生成的是直接的 DOM 操作，不是虛擬 DOM diff。這就是 Svelte bundle 小、執行快的根本原因。

## 響應式

```svelte
<script>
  let count = 0;
  let doubled = count * 2; // 不是響應式的！

  // Svelte 4: 用 $: 宣告響應式語句
  $: doubled = count * 2;
  $: console.log(`count 變為 ${count}`);

  // 響應式語句也支援塊
  $: {
    if (count > 10) {
      console.log("計數超過 10");
    }
  }
</script>
```

`$:` 是 Svelte 4 的響應式機制。編譯器分析依賴關係，在賦值時自動生成更新程式碼。但這個語法有些隱晦，Svelte 5 Runes 用 `$state` 和 `$derived` 替代。

## 元件通訊

```svelte
<!-- Child.svelte -->
<script>
  import { createEventDispatcher } from "svelte";

  export let name; // props
  export let count = 0; // 帶預設值的 prop

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
  name="張三"
  count={totalCount}
  on:change={(e) => totalCount = e.detail.count}
/>
```

## Svelte 5 Runes 預覽

```svelte
<!-- Svelte 5 新語法 -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log(`count is ${count}`);
    // 可以返回清理函式
    return () => console.log("cleanup");
  });
</script>

<button onclick={() => count++}>
  {count} * 2 = {doubled}
</button>
```

Runes 用函式呼叫替代了 `$:` 隱式語法，響應式關係更顯式、更可預測。

## 效能資料

TodoMVC 基準測試（Chrome 118, M2 MacBook）：

```
Svelte 4:   bundle 3.2KB, 建立 1000 行 12ms
React 18:   bundle 44KB,  建立 1000 行 18ms
Vue 3:      bundle 33KB,  建立 1000 行 15ms
```

Svelte 的 bundle 體積優勢在小專案上非常明顯。執行時效能差異在實際專案中不那麼大，但 Svelte 確實更快。

## 什麼時候選 Svelte

- 對 bundle 體積極度敏感的場景（嵌入式 widget、landing page）
- 團隊規模小、不想引入複雜的狀態管理
- 喜歡簡潔的模板語法

**不推薦的場景：**
- 大型團隊協作（生態和工具鏈不如 React/Vue 成熟）
- 需要豐富的第三方元件庫
- 已有 React/Vue 技術棧的專案

## 小結

- Svelte 是編譯時框架，沒有虛擬 DOM 執行時開銷
- Bundle 體積遠小於 React/Vue，適合對體積敏感的場景
- `$:` 響應式語法有隱晦之處，Svelte 5 Runes 是改進方向
- 生態系統在成長但遠不如 React/Vue 豐富
- 適合新專案和小團隊，不適合大型企業級應用的全棧替換