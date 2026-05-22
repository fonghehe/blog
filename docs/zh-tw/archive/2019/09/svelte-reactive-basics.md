---
title: "Svelte 響應式基礎語法詳解"
date: 2019-09-02 14:58:08
tags:
  - React
readingTime: 4
description: "Svelte 是一個全新的前端編譯框架，與 React 和 Vue 不同，它沒有虛擬 DOM，在編譯階段就將元件轉換為高效的命令式程式碼。Svelte 的響應式系統基於編譯時的賦值追蹤，語法極其簡潔。2019 年 Svelte 3 正式釋出，本文將帶你深入瞭解其響應式原理和核心語法。"
wordCount: 725
---

Svelte 是一個全新的前端編譯框架，與 React 和 Vue 不同，它沒有虛擬 DOM，在編譯階段就將元件轉換為高效的命令式程式碼。Svelte 的響應式系統基於編譯時的賦值追蹤，語法極其簡潔。2019 年 Svelte 3 正式釋出，本文將帶你深入瞭解其響應式原理和核心語法。

## Svelte 的核心理念

React 和 Vue 在執行時維護一套虛擬 DOM，通過 diff 演算法計算最小更新。Svelte 的思路完全不同：在編譯時分析元件的依賴關係，生成直接操作真實 DOM 的程式碼。

這意味著：
- 沒有虛擬 DOM 開銷
- 執行時程式碼更少（bundle 更小）
- 響應式不需要特殊的執行時庫

## 變數宣告即響應式

在 Svelte 中，普通的變數賦值就是響應式的：

```svelte
<script>
  let count = 0;

  function increment() {
    count += 1; // 直接賦值，自動觸發檢視更新
  }
</script>

<button on:click={increment}>
  點選了 {count} 次
</button>
```

編譯後的程式碼大致如下（簡化版）：

```js
function create_fragment(ctx) {
  let button;

  return {
    c() {
      button = element("button");
      button.textContent = `點選了 ${ctx.count} 次`;
    },
    m(target, anchor) {
      insert(target, button, anchor);
    },
    p(ctx, dirty) {
      if (dirty & 1) {
        set_data(button, `點選了 ${ctx.count} 次`);
      }
    },
    d(detaching) {
      if (detaching) detach(button);
    }
  };
}
```

Svelte 在編譯時就知道 `count` 變化會影響按鈕的文本，因此生成了精準的 DOM 更新程式碼。

## 響應式宣告 $

使用 `$:` 標記的語句是響應式宣告，當依賴的變數變化時自動重新執行：

```svelte
<script>
  let width = 100;
  let height = 50;

  // 響應式宣告：當 width 或 height 變化時重新計算
  $: area = width * height;
  $: perimeter = 2 * (width + height);

  // 響應式語句：更復雜的邏輯
  $: {
    console.log(`面積變為: ${area}`);
    if (area > 10000) {
      console.log('面積已經超過 10000！');
    }
  }

  // 條件響應式
  $: if (area > 5000) {
    console.log('面積已經超過 5000');
  }
</script>

<input type="number" bind:value={width} />
<input type="number" bind:value={height} />
<p>面積: {area}</p>
<p>周長: {perimeter}</p>
```

### 響應式宣告的依賴追蹤

Svelte 的響應式宣告通過靜態分析來確定依賴關係：

```svelte
<script>
  let items = [1, 2, 3];

  // 隻在 items 引用變化時重新計算
  $: total = items.reduce((a, b) => a + b, 0);

  function addItem() {
    // 直接 push 不會觸發響應式更新
    // items.push(4); // 不會更新 total！

    // 必須重新賦值
    items = [...items, 4]; // 這樣才會觸發更新
  }

  function addItemCorrect() {
    items.push(4);
    items = items; // 觸發響應式更新的常見技巧
  }
</script>

<button on:click={addItemCorrect}>新增</button>
<p>總和: {total}</p>
```

## 陣列和物件的響應式

Svelte 的響應式基於賦值操作，這意味著對陣列或物件的修改不會自動觸發更新：

```svelte
<script>
  let user = { name: '張三', age: 25 };
  let hobbies = ['coding', 'reading'];

  // 修改物件屬性 —— 不會觸發更新
  function wrongUpdate() {
    user.age = 26; // 不會更新檢視
  }

  // 正確方式：重新賦值
  function correctUpdate() {
    user = { ...user, age: 26 }; // 觸發更新
  }

  // 或者使用 "user = user" 技巧
  function alsoCorrect() {
    user.age = 26;
    user = user; // 觸發更新
  }

  // 陣列同理
  function addHobby() {
    hobbies = [...hobbies, 'gaming'];
  }

  function removeHobby(index) {
    hobbies = hobbies.filter((_, i) => i !== index);
  }
</script>

<p>{user.name} - {user.age}歲</p>
<button on:click={correctUpdate}>增加年齡</button>

<ul>
  {#each hobbies as hobby}
    <li>{hobby}</li>
  {/each}
</ul>
<button on:click={addHobby}>新增愛好</button>
```

## 使用 store 管理跨元件狀態

Svelte 提供了 writable store 和 readable store 來管理全域性狀態：

```js
// stores/counter.js
import { writable, derived } from 'svelte/store';

// writable store
export const count = writable(0);

// derived store：依賴其他 store 的值
export const doubled = derived(count, $count => $count * 2);

export const message = derived(
  count,
  $count => $count > 10 ? '太多了！' : '繼續加油'
);

// 自定義 store（封裝邏輯）
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

在元件中使用 store：

```svelte
<script>
  import { count, doubled, message, counter } from './stores/counter.js';
</script>

<!-- 使用 $ 字首自動訂閱和取消訂閱 -->
<p>計數: {$count}</p>
<p>雙倍: {$doubled}</p>
<p>{$message}</p>

<button on:click={() => $count++}>+1</button>

<!-- 使用自定義 store -->
<button on:click={counter.increment}>+1</button>
<button on:click={counter.decrement}>-1</button>
<button on:click={counter.reset}>重置</button>
```

`$count` 是 Svelte 的語法糖，等價於手動訂閱：

```svelte
<script>
  import { count } from './stores/counter.js';

  let countValue;
  count.subscribe(value => countValue = value);
  // $count 自動完成這個過程並在元件銷燬時取消訂閱
</script>
```

## bind 雙向繫結

Svelte 內建了簡潔的雙向繫結語法：

```svelte
<script>
  let name = '張三';
  let age = 25;
  let agreed = false;
  let color = 'red';
  let volume = 50;
</script>

<!-- 文本輸入 -->
<input bind:value={name} />
<p>你好，{name}</p>

<!-- 數字輸入 -->
<input type="number" bind:value={age} />

<!-- 核取方塊 -->
<input type="checkbox" bind:checked={agreed} />

<!-- 選擇框 -->
<select bind:value={color}>
  <option value="red">紅色</option>
  <option value="green">綠色</option>
  <option value="blue">藍色</option>
</select>

<!-- 範圍滑塊 -->
<input type="range" bind:value={volume} min="0" max="100" />

<!-- 分組繫結 -->
<input type="radio" bind:group={color} value="red" /> 紅
<input type="radio" bind:group={color} value="green" /> 綠
<input type="radio" bind:group={color} value="blue" /> 藍
```

## 元件生命週期

```svelte
<script>
  import { onMount, onDestroy, beforeUpdate, afterUpdate } from 'svelte';

  onMount(() => {
    console.log('元件掛載完成');
    // onMount 可以返回一個清理函式
    const timer = setInterval(() => console.log('tick'), 1000);
    return () => clearInterval(timer);
  });

  onDestroy(() => {
    console.log('元件即將銷燬');
  });

  beforeUpdate(() => {
    console.log('DOM 即將更新');
  });

  afterUpdate(() => {
    console.log('DOM 已更新');
  });
</script>
```

## Svelte 與 React/Vue 對比

| 維度 | Svelte | React | Vue |
|
------|--------|-------|-----|
| 編譯/執行時 | 純編譯 | 執行時 + 虛擬 DOM | 執行時 + 虛擬 DOM |
| 響應式 | 編譯時賦值追蹤 | 手動 setState/hooks | Object.defineProperty |
| 包體積 | 極小（無框架執行時） | 較大 | 中等 |
| 語法 | `.svelte` 單檔案 | JSX | `.vue` 單檔案 |
| 學習曲線 | 低 | 中 | 中 |
| 生態 | 較小 | 最大 | 大 |
| 適用場景 | 小型應用、嵌入式元件 | 大型 SPA | 大型 SPA |

## 小結

- Svelte 的響應式基於編譯時賦值追蹤，普通變數賦值即觸發檢視更新
- `$:` 標記響應式宣告，自動追蹤依賴的變數
- 陣列和物件的修改需要重新賦值才能觸發響應式更新，或者使用 `obj = obj` 技巧
- `writable` 和 `derived` store 提供了跨元件狀態管理方案
- `$store` 語法糖自動處理訂閱和取消訂閱
- `bind:` 提供了簡潔的雙向繫結語法
- Svelte 適合追求極致效能和最小包體積的場景，但生態不如 React 和 Vue 成熟
