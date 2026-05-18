---
title: "Solid.js：React 思维，原生性能"
date: 2022-07-12 16:06:23
tags:
  - 前端
readingTime: 3
description: "Solid.js 1.0 已经发布一年了，是时候认真体验一下。它的 JSX 写法和 React 几乎一样，但没有虚拟 DOM、没有 Diff、没有 Fiber——响应式更新直接操作真实 DOM。"
---

Solid.js 1.0 已经发布一年了，是时候认真体验一下。它的 JSX 写法和 React 几乎一样，但没有虚拟 DOM、没有 Diff、没有 Fiber——响应式更新直接操作真实 DOM。

## 为什么关注 Solid

React 的虚拟 DOM 模式带来了一个根本问题：每次状态变化，整个子树都要重新执行 render 函数，再通过 Diff 找出变化的部分。Solid 的答案是：不需要。

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

注意：`count` 是一个函数，需要 `count()` 获取值。这是 Solid 和 React 最大的区别——没有自动重新执行组件函数。

## 核心概念：createSignal

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

`createEffect` 类似 React 的 `useEffect`，但它自动追踪依赖（不需要依赖数组），且只在信号变化时重新执行。

## 组件只执行一次

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

点按钮时，`Parent` 和 `Child` 的函数体不会重新执行。Solid 直接更新 `<span>` 的文本节点。

## createStore：复杂状态管理

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

`createStore` 是嵌套的响应式对象，路径式更新——只有变化的部分会触发 DOM 更新。

## 控制流组件

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

这些不是普通的 if/for——Solid 的 `<For>` 使用 DOM 节点复用，不需要 key。

## 与 React 的对比

| 特性 | React | Solid |
|
------|-------|-------|
| 更新粒度 | 组件 | 精确 DOM 节点 |
| 虚拟 DOM | 有 | 没有 |
| 组件执行 | 每次更新都重跑 | 只执行一次 |
| 依赖追踪 | 依赖数组（手动） | 自动追踪 |
| Hooks 规则 | 有（不能条件调用） | 没有 |
| 学习曲线 | 中 | 低（如果会 React） |

## 实际性能

```
JS Framework Benchmark（越低越好）：

React 18:     1.24
Vue 3:        1.08
Solid 1.0:    1.02
Vanilla JS:   1.00
```

Solid 的性能接近原生 JS，在所有框架中最快。

## 小结

Solid.js 值得每个 React 开发者体验。它证明了 JSX 和响应式不一定要依赖虚拟 DOM。对于性能敏感的场景（大数据表格、实时数据流），Solid 是一个严肃的选择。但生态和社区还远不如 React，工具链和组件库需要时间成熟。