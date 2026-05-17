---
title: "SolidJS 初見：仮想DOMを覆す細粒度リアクティブフレームワーク"
date: 2021-07-02 14:50:14
tags:
  - JavaScript

readingTime: 2
description: "SolidJS 是 2021 年最值得关注的前端框架之一。它的核心主张听起来和 Svelte 相似——\"不用虚拟 DOM\"——但实现原理完全不同。Svelte 是编译时框架，SolidJS 是运行时细粒度响应式。这篇文章带你了解它为什么能在性能测试中长期排名第一。"
---

SolidJS 是 2021 年最值得关注的前端框架之一。它的核心主张听起来和 Svelte 相似——"不用虚拟 DOM"——但实现原理完全不同。Svelte 是编译时框架，SolidJS 是运行时细粒度响应式。这篇文章带你了解它为什么能在性能测试中长期排名第一。

## React との比較：似た構文、全く異なる原理

SolidJS 的语法刻意向 React 靠拢，但底层机制完全不同：

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

关键区别：

- React：状态变化 → 组件重新渲染 → Virtual DOM diff → DOM 更新
- SolidJS：状态变化 → **直接**更新用到这个状态的 DOM 节点

## リアクティブプリミティブ

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

注意：`count` 是函数，读取时要调用 `count()`——这是 SolidJS 和 React 最明显的语法区别。

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

## Store：嵌套响应式状态

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

## 制御フローコンポーネント

SolidJS 用组件替代 JSX 里的 JavaScript 控制流，以确保细粒度追踪：

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

## なぜパフォーマンスが良いのか

JS 框架性能测试（js-framework-benchmark）中，SolidJS 始终排名前列，接近原生 JavaScript：

| 框架     | 创建1000行 | 替换1000行 | 部分更新 |
| -------- | ---------- | ---------- | -------- |
| 原生 DOM | 1.0x       | 1.0x       | 1.0x     |
| SolidJS  | ~1.1x      | ~1.1x      | ~1.1x    |
| Vue 3    | ~1.3x      | ~1.5x      | ~1.6x    |
| React 17 | ~1.6x      | ~2.0x      | ~2.0x    |

原因：没有虚拟 DOM diff，状态变化直接转化为精确的 DOM 操作。

## まとめ

SolidJS 证明了"React 式 API + 细粒度响应式"是可行的。它不一定会取代 React 或 Vue，但它的设计思想正在影响整个生态——Vue 3 的 `@vue/reactivity` 和 Preact Signals 都有 SolidJS 的影子。2021 年值得用它做个小项目体验一下。