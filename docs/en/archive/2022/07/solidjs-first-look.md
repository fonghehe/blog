---
title: "Solid.js: React Thinking, Native Performance"
date: 2022-07-12 16:06:23
tags:
  - Frontend
readingTime: 2
description: "Solid.js 1.0 has been out for a year, and it's time to take it seriously. Its JSX syntax is nearly identical to React, but there's no virtual DOM, no Diff, no F"
wordCount: 351
---

Solid.js 1.0 has been out for a year, and it's time to take it seriously. Its JSX syntax is nearly identical to React, but there's no virtual DOM, no Diff, no Fiber — reactive updates operate directly on the real DOM.

## Why Pay Attention to Solid

React's virtual DOM model introduces a fundamental problem: every state change causes the entire subtree to re-execute the render function, then Diff finds the changed parts. Solid's answer: you don't need to.

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

Note: `count` is a function, you need `count()` to get the value. This is the biggest difference between Solid and React — no automatic re-execution of component functions.

## Core Concept: createSignal

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

`createEffect` is similar to React's `useEffect`, but it automatically tracks dependencies (no dependency array needed) and only re-executes when signals change.

## Components Execute Only Once

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

When clicking the button, the function bodies of `Parent` and `Child` do not re-execute. Solid directly updates the text node of `<span>`.

## createStore: Complex State Management

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

`createStore` is a nested reactive object with path-based updates — only the changed parts trigger DOM updates.

## Control Flow Components

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

These are not ordinary if/for — Solid's `<For>` uses DOM node reuse and doesn't need keys.

## Comparison with React

| 特性 | React | Solid |
|------|-------|-------|
| 更新粒度 | 组件 | 精确 DOM 节点 |
| 虚拟 DOM | 有 | 没有 |
| 组件执行 | 每次更新都重跑 | 只执行一次 |
| 依赖追踪 | 依赖数组（手动） | 自动追踪 |
| Hooks 规则 | 有（不能条件调用） | 没有 |
| 学习曲线 | 中 | 低（如果会 React） |

## Actual Performance

```
JS Framework Benchmark（越低越好）：

React 18:     1.24
Vue 3:        1.08
Solid 1.0:    1.02
Vanilla JS:   1.00
```

Solid 的性能接近原生 JS，在所有框架中最快。

## Summary

Solid.js is worth experiencing for every React developer. It proves that JSX and reactivity do not have to rely on virtual DOM. For performance-sensitive scenarios (large data tables, real-time data streams), Solid is a serious choice. But the ecosystem and community are far behind React, and the toolchain and component libraries still need time to mature.