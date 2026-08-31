---
title: "Svelteリアクティビティ：基本構文の詳解"
date: 2019-09-02 14:58:08
tags:
  - React
readingTime: 6
description: "Svelte 是一个全新的前端编译框架，与 React 和 Vue 不同，它没有虚拟 DOM，在编译阶段就将组件转换为高效的命令式代码。Svelte 的响应式系统基于编译时的赋值追踪，语法极其简洁。2019 年 Svelte 3 正式发布，本文将带你深入了解其响应式原理和核心语法。"
wordCount: 1193
---

Svelte は全く新しいフロントエンドのコンパイル型フレームワークだ。React や Vue と異なり、仮想 DOM を持たず、コンパイル時にコンポーネントを効率的な命令型コードへ変換する。Svelte のリアクティブシステムはコンパイル時の代入追跡に基づいており、構文は極めて簡潔だ。2019 年に Svelte 3 が正式リリースされたのを機に、本記事ではそのリアクティブの原理と中核となる構文を深く掘り下げる。

## Svelteのコア哲学

React と Vue は実行時に仮想 DOM を保持し、diff アルゴリズムで最小の更新を計算する。Svelte のアプローチは全く異なる。コンパイル時にコンポーネントの依存関係を解析し、実際の DOM を直接操作するコードを生成するのだ。

これは以下を意味する：
- 仮想 DOM のオーバーヘッドがない
- 実行時のコードが少ない（バンドルサイズが小さい）
- リアクティブに特別なランタイムライブラリは不要

## 変数宣言がそのままリアクティブ

Svelte では、普通の変数への代入そのものがリアクティブになる：

```svelte
<script>
  let count = 0;

  function increment() {
    count += 1; // 直接赋值，自动触发视图更新
  }
</script>

<button on:click={increment}>
  点击了 {count} 次
</button>
```

コンパイル後のコードはおおむね以下のようになる（簡略版）：

```js
function create_fragment(ctx) {
  let button;

  return {
    c() {
      button = element("button");
      button.textContent = `点击了 ${ctx.count} 次`;
    },
    m(target, anchor) {
      insert(target, button, anchor);
    },
    p(ctx, dirty) {
      if (dirty & 1) {
        set_data(button, `点击了 ${ctx.count} 次`);
      }
    },
    d(detaching) {
      if (detaching) detach(button);
    }
  };
}
```

Svelte はコンパイル時に `count` の変化がボタンのテキストに影響することを認識しているため、ピンポイントな DOM 更新コードを生成する。

## リアクティブ宣言 $

`$:` を付けた文はリアクティブ宣言となり、依存する変数が変化したとき自動的に再実行される：

```svelte
<script>
  let width = 100;
  let height = 50;

  // 响应式声明：当 width 或 height 变化时重新计算
  $: area = width * height;
  $: perimeter = 2 * (width + height);

  // 响应式语句：更复杂的逻辑
  $: {
    console.log(`面积变为: ${area}`);
    if (area > 10000) {
      console.log('面积已经超过 10000！');
    }
  }

  // 条件响应式
  $: if (area > 5000) {
    console.log('面积已经超过 5000');
  }
</script>

<input type="number" bind:value={width} />
<input type="number" bind:value={height} />
<p>面积: {area}</p>
<p>周长: {perimeter}</p>
```

### リアクティブ宣言の依存関係追跡

Svelte のリアクティブ宣言は静的解析によって依存関係を特定する：

```svelte
<script>
  let items = [1, 2, 3];

  // 只在 items 引用变化时重新计算
  $: total = items.reduce((a, b) => a + b, 0);

  function addItem() {
    // 直接 push 不会触发响应式更新
    // items.push(4); // 不会更新 total！

    // 必须重新赋值
    items = [...items, 4]; // 这样才会触发更新
  }

  function addItemCorrect() {
    items.push(4);
    items = items; // 触发响应式更新的常见技巧
  }
</script>

<button on:click={addItemCorrect}>添加</button>
<p>总和: {total}</p>
```

## 配列とオブジェクトのリアクティビティ

Svelte のリアクティブは代入操作に基づいているため、配列やオブジェクトの変更は自動的には更新をトリガーしない：

```svelte
<script>
  let user = { name: '张三', age: 25 };
  let hobbies = ['coding', 'reading'];

  // 修改对象属性 —— 不会触发更新
  function wrongUpdate() {
    user.age = 26; // 不会更新视图
  }

  // 正确方式：重新赋值
  function correctUpdate() {
    user = { ...user, age: 26 }; // 触发更新
  }

  // 或者使用 "user = user" 技巧
  function alsoCorrect() {
    user.age = 26;
    user = user; // 触发更新
  }

  // 数组同理
  function addHobby() {
    hobbies = [...hobbies, 'gaming'];
  }

  function removeHobby(index) {
    hobbies = hobbies.filter((_, i) => i !== index);
  }
</script>

<p>{user.name} - {user.age}岁</p>
<button on:click={correctUpdate}>增加年龄</button>

<ul>
  {#each hobbies as hobby}
    <li>{hobby}</li>
  {/each}
</ul>
<button on:click={addHobby}>添加爱好</button>
```

## storeによるコンポーネント間の状態管理

Svelte はグローバルな状態を管理するための writable store と readable store を提供している：

```js
// stores/counter.js
import { writable, derived } from 'svelte/store';

// writable store
export const count = writable(0);

// derived store：依赖其他 store 的值
export const doubled = derived(count, $count => $count * 2);

export const message = derived(
  count,
  $count => $count > 10 ? '太多了！' : '继续加油'
);

// 自定义 store（封装逻辑）
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

コンポーネント内で store を使うには：

```svelte
<script>
  import { count, doubled, message, counter } from './stores/counter.js';
</script>

<!-- 使用 $ 前缀自动订阅和取消订阅 -->
<p>计数: {$count}</p>
<p>双倍: {$doubled}</p>
<p>{$message}</p>

<button on:click={() => $count++}>+1</button>

<!-- 使用自定义 store -->
<button on:click={counter.increment}>+1</button>
<button on:click={counter.decrement}>-1</button>
<button on:click={counter.reset}>重置</button>
```

`$count` は Svelte の糖衣構文（シンタックスシュガー）で、手動の購読と等価だ：

```svelte
<script>
  import { count } from './stores/counter.js';

  let countValue;
  count.subscribe(value => countValue = value);
  // $count 自动完成这个过程并在组件销毁时取消订阅
</script>
```

## bindによる双方向バインディング

Svelte には簡潔な双方向バインディング構文が組み込まれている：

```svelte
<script>
  let name = '张三';
  let age = 25;
  let agreed = false;
  let color = 'red';
  let volume = 50;
</script>

<!-- 文本输入 -->
<input bind:value={name} />
<p>你好，{name}</p>

<!-- 数字输入 -->
<input type="number" bind:value={age} />

<!-- 复选框 -->
<input type="checkbox" bind:checked={agreed} />

<!-- 选择框 -->
<select bind:value={color}>
  <option value="red">红色</option>
  <option value="green">绿色</option>
  <option value="blue">蓝色</option>
</select>

<!-- 范围滑块 -->
<input type="range" bind:value={volume} min="0" max="100" />

<!-- 分组绑定 -->
<input type="radio" bind:group={color} value="red" /> 红
<input type="radio" bind:group={color} value="green" /> 绿
<input type="radio" bind:group={color} value="blue" /> 蓝
```

## コンポーネントライフサイクル

```svelte
<script>
  import { onMount, onDestroy, beforeUpdate, afterUpdate } from 'svelte';

  onMount(() => {
    console.log('组件挂载完成');
    // onMount 可以返回一个清理函数
    const timer = setInterval(() => console.log('tick'), 1000);
    return () => clearInterval(timer);
  });

  onDestroy(() => {
    console.log('组件即将销毁');
  });

  beforeUpdate(() => {
    console.log('DOM 即将更新');
  });

  afterUpdate(() => {
    console.log('DOM 已更新');
  });
</script>
```

## Svelte vs React/Vue 比較

| 観点 | Svelte | React | Vue |
|------|--------|-------|-----|
| コンパイル/実行時 | 純コンパイル | 実行時 + 仮想 DOM | 実行時 + 仮想 DOM |
| リアクティビティ | コンパイル時の代入追跡 | 手動 setState/hooks | Object.defineProperty |
| バンドルサイズ | 極小（フレームワークランタイムなし） | やや大きい | 中程度 |
| 構文 | `.svelte` 単一ファイル | JSX | `.vue` 単一ファイル |
| 学習曲線 | 低い | 中 | 中 |
| エコシステム | 小さい | 最大 | 大 |
| 向いている場面 | 小規模アプリ・組み込みコンポーネント | 大規模 SPA | 大規模 SPA |

## まとめ

- Svelte のリアクティブはコンパイル時の代入追跡に基づき、普通の変数代入だけでビューの更新がトリガーされる
- `$:` はリアクティブ宣言を表し、依存する変数を自動的に追跡する
- 配列やオブジェクトの変更は、再代入して初めてリアクティブ更新が発生する。あるいは `obj = obj` の技法を使う
- `writable` と `derived` store がコンポーネント間の状態管理の手段を提供する
- `$store` という糖衣構文が購読と購読解除を自動処理する
- `bind:` は簡潔な双方向バインディング構文を提供する
- Svelte は究極のパフォーマンスや最小のバンドルサイズを求める場面に向いているが、エコシステムの成熟度は React や Vue に劣る
