---
title: "SolidJS 初見：仮想DOMを覆す細粒度リアクティブフレームワーク"
date: 2021-07-02 14:50:14
tags:
  - JavaScript

readingTime: 3
description: "SolidJS は2021年で最も注目すべきフロントエンドフレームワークの1つです。その核となる主張は Svelte と似ています——「仮想 DOM を使わない」——しかし、実装原理はまったく異なります。Svelte はコンパイル時フレームワークであり、SolidJS は実行時の細粒度リアクティブシステムです。この記事では、なぜパフォーマンステストで長期間トップを維持できるのかを解説します。"
wordCount: 697
---

SolidJS は 2021 年で最も注目すべきフロントエンドフレームワークの 1 つです。その核となる主張は Svelte と似ています——「仮想 DOM を使わない」——しかし、実装原理はまったく異なります。Svelte はコンパイル時フレームワークであり、SolidJS は実行時の細粒度リアクティブシステムです。この記事では、なぜパフォーマンステストで長期間トップを維持できるのかを解説します。

## React との比較：似た構文、全く異なる原理

SolidJS の構文は意図的に React に近づけられていますが、内部の仕組みはまったく異なります：

```jsx
// React
function Counter() {
  const [count, setCount] = useState(0);
  // count が変化するたびに関数全体が再実行される
  // Virtual DOM diff で更新が必要な DOM を特定
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// SolidJS
function Counter() {
  const [count, setCount] = createSignal(0);
  // 関数は1回だけ実行される！
  // count が変化すると、count() を使用している DOM ノードだけが更新される
  return <button onClick={() => setCount((c) => c + 1)}>{count()}</button>;
}
```

主な違い：

- React：状態変化 → コンポーネントの再レンダリング → Virtual DOM diff → DOM 更新
- SolidJS：状態変化 → その状態を使用している DOM ノードを**直接**更新

## リアクティブプリミティブ

```jsx
import { createSignal, createMemo, createEffect, onCleanup } from "solid-js";

function App() {
  const [count, setCount] = createSignal(0);
  const [name, setName] = createSignal("Alice");

  // createMemo：派生値、依存関係を自動追跡
  const doubled = createMemo(() => count() * 2);

  // createEffect：副作用、依存関係が変化すると自動で再実行
  createEffect(() => {
    console.log(`count: ${count()}, doubled: ${doubled()}`);
    // onCleanup は effect の再実行前に呼ばれる
    onCleanup(() => console.log("cleanup"));
  });

  return (
    <div>
      <p>
        Count: {count()}, Doubled: {doubled()}
      </p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}
```

注意：`count` は関数であり、読み取る際は `count()` と呼び出す必要があります——これが SolidJS と React の最も明確な構文上の違いです。

## 細粒度更新の利点

```jsx
function List() {
  const [items, setItems] = createSignal([
    { id: 1, text: "Item 1", done: false },
    { id: 2, text: "Item 2", done: false },
  ]);

  const toggleItem = (id) => {
    setItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    );
  };

  return (
    <ul>
      {/* For コンポーネント：リスト項目は対応するデータが変化したときのみ更新され、リスト全体が再レンダリングされることはない */}
      <For each={items()}>
        {(item) => (
          <li
            style={{ "text-decoration": item.done ? "line-through" : "none" }}
            onClick={() => toggleItem(item.id)}
          >
            {item.text}
          </li>
        )}
      </For>
    </ul>
  );
}
```

## Store：入れ子になったリアクティブ状態

```jsx
import { createStore } from 'solid-js/store';

function TodoApp() {
  const [state, setState] = createStore({
    todos: [
      { id: 1, text: '学習 SolidJS', done: false }
    ],
    filter: 'all'
  });

  // 細粒度更新：id=1 の done プロパティのみを更新
  const toggleTodo = (id) => {
    setState('todos', todo => todo.id === id, 'done', done => !done);
  };

  // 算出プロパティ
  const visibleTodos = () => {
    if (state.filter === 'active') return state.todos.filter(t => !t.done);
    if (state.filter === 'done') return state.todos.filter(t => t.done);
    return state.todos;
  };

  return (/* ... */);
}
```

## 制御フローコンポーネント

SolidJS は JSX 内の JavaScript 制御フローの代わりにコンポーネントを使用し、細粒度の追跡を保証します：

```jsx
// Show：条件付きレンダリング（&& の代替）
<Show when={count() > 5} fallback={<p>Count はまだ大きくない</p>}>
  <p>Count はもう 5 を超えました！</p>
</Show>

// For：リストレンダリング（map の代替）
<For each={items()} fallback={<p>リストは空です</p>}>
  {(item, index) => <li>{index() + 1}. {item.name}</li>}
</For>

// Switch/Match：複数条件分岐
<Switch fallback={<p>未知の状態</p>}>
  <Match when={status() === 'loading'}><Spinner /></Match>
  <Match when={status() === 'error'}><ErrorMessage /></Match>
  <Match when={status() === 'success'}><Content /></Match>
</Switch>
```

## なぜパフォーマンスが良いのか

JS フレームワークのパフォーマンステスト（js-framework-benchmark）において、SolidJS は常に上位にランクインしており、ネイティブ JavaScript に近い結果を出しています：

| フレームワーク | 1000行作成 | 1000行置換 | 部分更新 |
| -------- | ---------- | ---------- | -------- |
| ネイティブ DOM | 1.0x       | 1.0x       | 1.0x     |
| SolidJS  | ~1.1x      | ~1.1x      | ~1.1x    |
| Vue 3    | ~1.3x      | ~1.5x      | ~1.6x    |
| React 17 | ~1.6x      | ~2.0x      | ~2.0x    |

理由：仮想 DOM の diff がなく、状態変化が直接正確な DOM 操作に変換されるためです。

## まとめ

SolidJS は「React スタイルの API + 細粒度リアクティブ」が実現可能であることを証明しました。React や Vue を置き換えることはないかもしれませんが、その設計思想はエコシステム全体に影響を与えています——Vue 3 の `@vue/reactivity` や Preact Signals には SolidJS の影響が見られます。2021 年、これを使って小さなプロジェクトを作り、体験してみる価値があります。
