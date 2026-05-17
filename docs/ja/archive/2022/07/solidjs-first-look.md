---
title: "Solid.js：React思考、ネイティブパフォーマンス"
date: 2022-07-12 16:06:23
tags:
  - フロントエンド
readingTime: 3
description: "Solid.js 1.0 がリリースされて1年が経ちました。真剣に体験してみる時です。JSXの書き方はReactとほぼ同じですが、仮想DOM、Diff、Fiberがなく——リアクティブな更新が直接実際のDOMを操作します。"
---

Solid.js 1.0 がリリースされて1年が経ちました。真剣に体験してみる時です。JSXの書き方はReactとほぼ同じですが、仮想DOM、Diff、Fiberがなく——リアクティブな更新が直接実際のDOMを操作します。

## なぜ Solid に注目するのか

Reactの仮想DOMモデルには根本的な問題があります：状態が変化するたびにサブツリー全体でrender関数を再実行し、Diffで変化した部分を見つける必要があります。Solidの答えは：その必要はない。

```jsx
// Solid.js
import { createSignal, For } from 'solid-js';

function Counter() {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <p>计数: {count()}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

注意：`count` は関数であり、`count()` で値を取得する必要があります。これが Solid と React の最大の違いです——コンポーネント関数の自動再実行がありません。

## コアコンセプト：createSignal

```jsx
import { createSignal, createEffect } from 'solid-js';

function App() {
  const [name, setName] = createSignal('World');
  const [greeting, setGreeting] = createSignal('Hello');

  // createEffect 只在依赖变化时执行
  createEffect(() => {
    console.log(`当前问候: ${greeting()}, ${name()}`);
  });

  return (
    <div>
      <input
        value={name()}
        onInput={(e) => setName(e.target.value)}
      />
      <p>{greeting()}, {name()}!</p>
    </div>
  );
}
```

`createEffect` は React の `useEffect` に似ていますが、自動的に依存関係を追跡し（依存配列は不要）、シグナルが変化したときのみ再実行されます。

## コンポーネントは一度だけ実行される

```jsx
function Parent() {
  const [count, setCount] = createSignal(0);

  // 这个 console.log 只在初始渲染时执行一次！
  console.log('Parent 渲染');

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <Child count={count()} />
    </div>
  );
}

function Child(props) {
  // Child 也只在初始渲染时执行一次
  console.log('Child 渲染');

  return <span>{props.count}</span>;
}
```

ボタンをクリックしても、`Parent` と `Child` の関数本体は再実行されません。Solid は `<span>` のテキストノードを直接更新します。

## createStore：複雑な状態管理

```jsx
import { createStore, produce } from 'solid-js';

function TodoApp() {
  const [state, setState] = createStore({
    todos: [
      { id: 1, text: '学 Solid', done: false },
      { id: 2, text: '写博客', done: false },
    ],
    filter: 'all',
  });

  function addTodo(text) {
    setState('todos', (todos) => [
      ...todos,
      { id: Date.now(), text, done: false },
    ]);
  }

  function toggleTodo(id) {
    setState(
      'todos',
      (todo) => todo.id === id,
      'done',
      (done) => !done
    );
  }

  return (
    <div>
      <For each={state.todos}>
        {(todo) => (
          <li
            style={{ 'text-decoration': todo.done ? 'line-through' : 'none' }}
            onClick={() => toggleTodo(todo.id)}
          >
            {todo.text}
          </li>
        )}
      </For>
    </div>
  );
}
```

`createStore` はネストされたリアクティブオブジェクトで、パスベースの更新——変化した部分のみが DOM 更新をトリガーします。

## 制御フローコンポーネント

```jsx
import { Show, For, Switch, Match, Suspense } from 'solid-js';

function UserProfile({ user }) {
  return (
    <Show when={user()} fallback={<div>加载中...</div>}>
      <div>
        <h1>{user().name}</h1>
        <p>{user().bio}</p>
      </div>
    </Show>
  );
}

function App() {
  const [tab, setTab] = createSignal('home');

  return (
    <Switch fallback={<div>404</div>}>
      <Match when={tab() === 'home'}>
        <HomePage />
      </Match>
      <Match when={tab() === 'profile'}>
        <ProfilePage />
      </Match>
    </Switch>
  );
}
```

これらは通常の if/for ではありません——Solid の `<For>` は DOM ノードの再利用を使用し、key が不要です。

## React との比較

| 特性 | React | Solid |
|------|-------|-------|
| 更新粒度 | 组件 | 精确 DOM 节点 |
| 虚拟 DOM | 有 | 没有 |
| 组件执行 | 每次更新都重跑 | 只执行一次 |
| 依赖追踪 | 依赖数组（手动） | 自动追踪 |
| Hooks 规则 | 有（不能条件调用） | 没有 |
| 学习曲线 | 中 | 低（如果会 React） |

## 実際のパフォーマンス

```
JS Framework Benchmark（越低越好）：

React 18:     1.24
Vue 3:        1.08
Solid 1.0:    1.02
Vanilla JS:   1.00
```

Solid 的性能接近原生 JS，在所有框架中最快。

## まとめ

Solid.js はすべての React 開発者が体験する価値があります。JSX とリアクティビティは仮想 DOM に依存する必要がないことを証明しています。パフォーマンスが重要なシナリオ（大規模データテーブル、リアルタイムデータストリーム）では、Solid は真剣な選択肢です。しかし、エコシステムとコミュニティは React に遠く及ばず、ツールチェーンとコンポーネントライブラリは成熟するまで時間が必要です。