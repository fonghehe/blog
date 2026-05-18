---
title: "Svelte 初體驗：沒有 Virtual DOM 的框架"
date: 2019-04-07 10:35:05
tags:
  - Svelte
readingTime: 2
description: "Svelte 3 上週釋出了，和 Vue/React 思路完全不同——編譯時框架，沒有執行時，沒有 Virtual DOM。用了一週，說說感受。"
---

Svelte 3 上週釋出了，和 Vue/React 思路完全不同——編譯時框架，沒有執行時，沒有 Virtual DOM。用了一週，說說感受。

## 和 Vue/React 最大的區別

Vue/React：執行時框架，需要載入框架程式碼（~30KB+），在瀏覽器裡做響應式。

Svelte：編譯時框架，把 `.svelte` 檔案編譯成高效的 vanilla JS，打包後幾乎沒有框架體積。

## Svelte 語法

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0
  let name = 'World'

  // 響應式宣告（computed）
  $: doubled = count * 2
  $: console.log('count 變了:', count)  // 響應式副作用

  function increment() {
    count += 1
  }
</script>

<!-- 模板 -->
<h1>Hello {name}!</h1>
<p>Count: {count}, Doubled: {doubled}</p>
<button on:click={increment}>+1</button>

<!-- 條件和迴圈 -->
{#if count > 10}
  <p>大於 10 了！</p>
{:else if count > 5}
  <p>超過一半了</p>
{:else}
  <p>繼續加油</p>
{/if}

{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}

<style>
  /* 樣式自動 scope！ */
  button { background: blue; color: white; }
</style>
```

## 響應式不需要 this

```svelte
<script>
  let user = { name: 'Alice', age: 25 }

  // 物件賦值觸發更新（注意：必須賦值，push 不會觸發）
  function birthday() {
    user = { ...user, age: user.age + 1 }  // 或者 user.age += 1
  }

  let todos = []
  function addTodo(text) {
    todos = [...todos, { id: Date.now(), text, done: false }]
    // todos.push(xxx) 不觸發更新！
  }
</script>
```

## Store（全域性狀態）

```javascript
// stores.js
import { writable, derived, readable } from "svelte/store";

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);
export const time = readable(new Date(), (set) => {
  const interval = setInterval(() => set(new Date()), 1000);
  return () => clearInterval(interval);
});
```

```svelte
<script>
  import { count, doubled, time } from './stores'

  // $字首自動訂閱/取消訂閱
</script>

<p>Count: {$count}</p>
<p>Doubled: {$doubled}</p>
<p>Time: {$time.toLocaleTimeString()}</p>
<button on:click={() => $count += 1}>+1</button>
```

## 和 React/Vue 比較

|            | Svelte                 | Vue 3    | React    |
| 
---------- | ---------------------- | -------- | -------- |
| 執行時體積 | ~1KB                   | ~22KB    | ~42KB    |
| 學習成本   | 低（貼近原生 HTML/JS） | 中       | 中       |
| 生態       | 弱（2019年還小眾）     | 強       | 很強     |
| 大型專案   | 待驗證                 | 經過驗證 | 經過驗證 |

## 我的結論

Svelte 適合：

- 效能極度敏感的場景（嵌入式元件、小工具）
- 個人專案、快速原型

目前不建議用於大型生產專案，主要是生態不夠成熟、TypeScript 支援一般（2019年還早）、社群還小。

但它的思路很有啟發性，可能代表未來編譯時框架的方向。

## 小結

- Svelte 把響應式編譯進 JS，不需要執行時，體積極小
- 語法比 Vue/React 更接近原生 HTML
- `$:` 實現響應式宣告，`$store` 自動訂閱
- 2019年生態還弱，大型專案謹慎使用
