---
title: "Svelte 3を初めて触って：Virtual DOMなしのフレームワーク"
date: 2019-04-07 10:35:05
tags:
  - Svelte
readingTime: 1
description: "Svelte 3が先週リリースされました。Vue/Reactとは全く異なるアプローチを取っています——コンパイル時フレームワークで、ランタイムもVirtual DOMもありません。1週間使ってみた感想をお伝えします。"
wordCount: 280
---

Svelte 3が先週リリースされました。Vue/Reactとは全く異なるアプローチを取っています——コンパイル時フレームワークで、ランタイムもVirtual DOMもありません。1週間使ってみた感想をお伝えします。

## Vue/Reactとの最大の違い

**Vue/React**：ランタイムフレームワークで、フレームワークのコード（約30KB以上）を読み込み、ブラウザでリアクティビティを実現します。

**Svelte**：コンパイル時フレームワークで、`.svelte`ファイルを効率的なバニラJSにコンパイルします。最終バンドルにはほぼフレームワークのオーバーヘッドがありません。

## Sveltの構文

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0
  let name = 'World'

  // リアクティブ宣言（computed）
  $: doubled = count * 2
  $: console.log('countが変わった:', count)  // リアクティブな副作用

  function increment() {
    count += 1
  }
</script>

<!-- テンプレート -->
<h1>Hello {name}!</h1>
<p>Count: {count}, Doubled: {doubled}</p>
<button on:click={increment}>+1</button>

<!-- 条件と繰り返し -->
{#if count > 10}
  <p>10を超えました！</p>
{:else if count > 5}
  <p>半分を超えました</p>
{:else}
  <p>頑張り続けましょう</p>
{/if}

{#each items as item (item.id)}
  <li>{item.name}</li>
{/each}

<style>
  /* スタイルは自動的にスコープされます！ */
  button { background: blue; color: white; }
</style>
```

## `this`なしのリアクティビティ

```svelte
<script>
  let user = { name: 'Alice', age: 25 }

  // オブジェクトへの代入で更新がトリガー（注意：pushは更新をトリガーしない）
  function birthday() {
    user = { ...user, age: user.age + 1 }  // または user.age += 1
  }

  let todos = []
  function addTodo(text) {
    todos = [...todos, { id: Date.now(), text, done: false }]
    // todos.push(xxx)は更新をトリガーしない！
  }
</script>
```

## Store（グローバル状態）

```javascript
// stores.js
import { writable, derived, readable } from "svelte/store";

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);
```

バンドルサイズが重要なプロジェクトではSvelteは魅力的な選択肢です。まだ試していない方はぜひ一度使ってみてください。
