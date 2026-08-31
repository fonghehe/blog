---
title: "SolidJS First Look: Fine-Grained Reactivity That Challenges Virtual DOM"
date: 2021-07-02 14:50:14
tags:
  - JavaScript

readingTime: 2
description: "SolidJS is one of the most noteworthy front-end frameworks of 2021. Its core claim sounds similar to Svelte's — \"no virtual DOM\" — but the implementation is completely different. Svelte is a compile-time framework, whereas SolidJS is runtime, fine-grained reactivity. This article walks you through why it consistently ranks at the top of performance benchmarks."
wordCount: 281
---

SolidJS is one of the most noteworthy front-end frameworks of 2021. Its core claim sounds similar to Svelte's — "no virtual DOM" — but the implementation is completely different. Svelte is a compile-time framework, whereas SolidJS is runtime, fine-grained reactivity. This article walks you through why it consistently ranks at the top of performance benchmarks.

## Comparison with React: Similar Syntax, Fundamentally Different Principles

SolidJS deliberately mimics React's syntax, but the underlying mechanism is completely different:

```jsx
// React
function Counter() {
  const [count, setCount] = useState(0);
  // 每次 count 变化，整个函数重新执行
  // Virtual DOM diff 找出需要更新的 DOM
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// SolidJS
function Counter() {
  const [count, setCount] = createSignal(0);
  // 函数只执行一次！
  // count 变化时，只有用到 count() 的 DOM 节点更新
  return <button onClick={() => setCount((c) => c + 1)}>{count()}</button>;
}
```

The key difference:

- React: state change → component re-renders → Virtual DOM diff → DOM update
- SolidJS: state change → **directly** updates the DOM nodes that consume that state

## Reactive Primitives

```jsx
import { createSignal, createMemo, createEffect, onCleanup } from "solid-js";

function App() {
  const [count, setCount] = createSignal(0);
  const [name, setName] = createSignal("Alice");

  // createMemo：衍生值，自动追踪依赖
  const doubled = createMemo(() => count() * 2);

  // createEffect：副作用，依赖变化时自动重新执行
  createEffect(() => {
    console.log(`count: ${count()}, doubled: ${doubled()}`);
    // onCleanup 在 effect 重新执行前调用
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

Note: `count` is a function, so you call `count()` to read it — this is the most visible syntax difference between SolidJS and React.

## Benefits of Fine-Grained Updates

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
      {/* For 组件：列表项只在对应数据变化时更新，不重新渲染整个列表 */}
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

## Store: Nested Reactive State

```jsx
import { createStore } from 'solid-js/store';

function TodoApp() {
  const [state, setState] = createStore({
    todos: [
      { id: 1, text: '学习 SolidJS', done: false }
    ],
    filter: 'all'
  });

  // 细粒度更新：只更新 id=1 的 done 属性
  const toggleTodo = (id) => {
    setState('todos', todo => todo.id === id, 'done', done => !done);
  };

  // 计算属性
  const visibleTodos = () => {
    if (state.filter === 'active') return state.todos.filter(t => !t.done);
    if (state.filter === 'done') return state.todos.filter(t => t.done);
    return state.todos;
  };

  return (/* ... */);
}
```

## Control Flow Components

SolidJS replaces JavaScript control flow inside JSX with components to guarantee fine-grained tracking:

```jsx
// Show：条件渲染（替代 &&）
<Show when={count() > 5} fallback={<p>Count 还不够大</p>}>
  <p>Count 已经 > 5 了！</p>
</Show>

// For：列表渲染（替代 map）
<For each={items()} fallback={<p>列表为空</p>}>
  {(item, index) => <li>{index() + 1}. {item.name}</li>}
</For>

// Switch/Match：多条件分支
<Switch fallback={<p>未知状态</p>}>
  <Match when={status() === 'loading'}><Spinner /></Match>
  <Match when={status() === 'error'}><ErrorMessage /></Match>
  <Match when={status() === 'success'}><Content /></Match>
</Switch>
```

## Why the Performance Is So Good

In the js-framework-benchmark, SolidJS consistently ranks near the top, close to vanilla JavaScript:

| 框架     | 创建1000行 | 替换1000行 | 部分更新 |
| -------- | ---------- | ---------- | -------- |
| 原生 DOM | 1.0x       | 1.0x       | 1.0x     |
| SolidJS  | ~1.1x      | ~1.1x      | ~1.1x    |
| Vue 3    | ~1.3x      | ~1.5x      | ~1.6x    |
| React 17 | ~1.6x      | ~2.0x      | ~2.0x    |

The reason: with no virtual DOM diff, a state change turns directly into a precise DOM operation.

## Summary

SolidJS proves that a React-style API combined with fine-grained reactivity is viable. It may not replace React or Vue, but its design thinking is already influencing the whole ecosystem — Vue 3's `@vue/reactivity` and Preact Signals both show SolidJS's fingerprints. In 2021 it's worth building a small project with it to get a feel for it.