---
title: "Svelte 入門：コンパイル時フレームワークとリアクティブの原理"
date: 2020-04-25 09:58:21
tags:
  - Svelte
readingTime: 3
description: "Svelte 3 は 2019 年のリリース後、大きな注目を集めました。その核となる主張は、フレームワークはコンパイル時に処理を完了すべきであり、実行時に行うべきではないというものです。つまり、Svelte には仮想 DOM がなく、ランタイムフレームワークコードもなく、生成される成果物はネイティブ DOM 操作を行う JavaScript です。"
wordCount: 644
---

Svelte 3 は 2019 年のリリース後、大きな注目を集めました。その核となる主張は、**フレームワークはコンパイル時に処理を完了すべきであり、実行時に行うべきではない**というものです。つまり、Svelte には仮想 DOM がなく、ランタイムフレームワークコードもなく、生成される成果物はネイティブ DOM 操作を行う JavaScript です。

## React/Vueとの本質的な違い

```
React/Vue のワークフロー：
ユーザーコード → フレームワークランタイム（仮想 DOM diff）→ DOM 更新

Svelte のワークフロー：
ユーザーコード → コンパイラ（効率的な DOM 操作コードを生成）→ 純粋な JS → DOM 更新
```

結果：Svelte アプリのバンドルにはフレームワークランタイムが含まれず、Hello World の gzip サイズは約 1.6KB です。

## 基本構文

Svelte コンポーネントは `.svelte` ファイルで、Vue の単一ファイルコンポーネントに似た構造です：

```svelte
<!-- Counter.svelte -->
<script>
  let count = 0;

  function increment() {
    count++;
  }

  // リアクティブ宣言：$: で始まり、依存関係が変化すると自動的に再計算
  $: doubled = count * 2;
  $: {
    console.log(`count changed to ${count}`);
  }
</script>

<button on:click={increment}>
  {count} 回クリック（doubled: {doubled}）
</button>

<style>
  button {
    /* スタイルは自動的にスコープされ、漏洩しません */
    background: #ff3e00;
    color: white;
  }
</style>
```

## リアクティブシステム

Svelte のリアクティブは**代入**によってトリガーされ、setter や Proxy ではありません：

```svelte
<script>
  let arr = [1, 2, 3];
  let obj = { name: 'Alice' };

  function addItem() {
    arr = [...arr, arr.length + 1];  // ✅ 代入で更新をトリガー
    // arr.push(4);                  // ❌ 更新をトリガーしない（代入がない）
  }

  function updateName() {
    obj.name = 'Bob';  // ✅ オブジェクトのプロパティ代入もトリガー（Svelte が特別処理）
  }
</script>
```

## Props とイベント

```svelte
<!-- Child.svelte -->
<script>
  export let name;        // export で prop を宣言
  export let age = 18;    // デフォルト値

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('greet', { message: `Hello, ${name}!` });
  }
</script>

<button on:click={handleClick}>{name} に挨拶</button>

<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte';

  function handleGreet(event) {
    alert(event.detail.message);
  }
</script>

<Child name="Alice" age={25} on:greet={handleGreet} />
```

## Store（状態管理）

```javascript
// stores.js
import { writable, derived } from "svelte/store";

export const count = writable(0);
export const doubled = derived(count, ($count) => $count * 2);

// コンポーネント内で $ プレフィックスを使用して自動購読・購読解除
```

```svelte
<script>
  import { count, doubled } from './stores.js';
</script>

<p>Count: {$count}, Doubled: {$doubled}</p>
<button on:click={() => $count++}>+1</button>
```

## コンパイル後のコード

Svelte のリアクティブ代入 `count++` はコンパイル後、次のようになります：

```javascript
// コンパイル後（簡略化）
function increment() {
  $$invalidate(0, count++, count); // 更新が必要であることを直接マーク
}
```

仮想 DOM diff がなく、直接 DOM を操作するため、パフォーマンスベンチマークでトップクラスです。

## 適用シーン

- 極限のバンドルサイズ（組み込み、低スペックデバイス）
- 独立した小さなコンポーネント/Widget を非 SPA ページに埋め込む
- 迅速なプロトタイプ開発（シンプルな構文で習得が早い）

あまり適さない：超大規模チームプロジェクト（TypeScript サポートが Angular より弱い）、豊富なエコシステムが必要な場合（Angular Material、Ant Design のような成熟した UI ライブラリは現在 Svelte 版が少ない）。

## まとめ

Svelte は React や Vue を置き換えるものではなく、異なるアプローチを提供しています：**フレームワークの複雑さを実行時からコンパイル時に移す**ということです。メインフレームワークが Svelte でなくても、その設計思想を理解することは、フロントエンドフレームワークの本質を理解する上で非常に役立ちます。
