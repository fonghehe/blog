---
title: "SolidJS 初探：顛覆虛擬 DOM 的細粒度響應式框架"
date: 2021-07-02 14:50:14
tags:
  - 前端
  - JavaScript
readingTime: 2
description: "SolidJS 是 2021 年最值得關注的前端框架之一。它的核心主張聽起來和 Svelte 相似——\"不用虛擬 DOM\"——但實現原理完全不同。Svelte 是編譯時框架，SolidJS 是運行時細粒度響應式。這篇文章帶你瞭解它為什麼能在性能測試中長期排名第一。"
---

SolidJS 是 2021 年最值得關注的前端框架之一。它的核心主張聽起來和 Svelte 相似——"不用虛擬 DOM"——但實現原理完全不同。Svelte 是編譯時框架，SolidJS 是運行時細粒度響應式。這篇文章帶你瞭解它為什麼能在性能測試中長期排名第一。

## 和 React 的對比：相似的語法，截然不同的原理

SolidJS 的語法刻意向 React 靠攏，但底層機制完全不同：

```jsx
// React
function Counter() {
  const [count, setCount] = useState(0);
  // 每次 count 變化，整個函數重新執行
  // Virtual DOM diff 找出需要更新的 DOM
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// SolidJS
function Counter() {
  const [count, setCount] = createSignal(0);
  // 函數只執行一次！
  // count 變化時，只有用到 count() 的 DOM 節點更新
  return <button onClick={() => setCount((c) => c + 1)}>{count()}</button>;
}
```

關鍵區別：

- React：狀態變化 → 組件重新渲染 → Virtual DOM diff → DOM 更新
- SolidJS：狀態變化 → **直接**更新用到這個狀態的 DOM 節點

## 響應式原語

```jsx
import { createSignal, createMemo, createEffect, onCleanup } from "solid-js";

function App() {
  const [count, setCount] = createSignal(0);
  const [name, setName] = createSignal("Alice");

  // createMemo：衍生值，自動追蹤依賴
  const doubled = createMemo(() => count() * 2);

  // createEffect：副作用，依賴變化時自動重新執行
  createEffect(() => {
    console.log(`count: ${count()}, doubled: ${doubled()}`);
    // onCleanup 在 effect 重新執行前調用
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

注意：`count` 是函數，讀取時要調用 `count()`——這是 SolidJS 和 React 最明顯的語法區別。

## 細粒度更新的好處

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
      {/* For 組件：列表項只在對應數據變化時更新，不重新渲染整個列表 */}
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

## Store：嵌套響應式狀態

```jsx
import { createStore } from 'solid-js/store';

function TodoApp() {
  const [state, setState] = createStore({
    todos: [
      { id: 1, text: '學習 SolidJS', done: false }
    ],
    filter: 'all'
  });

  // 細粒度更新：只更新 id=1 的 done 屬性
  const toggleTodo = (id) => {
    setState('todos', todo => todo.id === id, 'done', done => !done);
  };

  // 計算屬性
  const visibleTodos = () => {
    if (state.filter === 'active') return state.todos.filter(t => !t.done);
    if (state.filter === 'done') return state.todos.filter(t => t.done);
    return state.todos;
  };

  return (/* ... */);
}
```

## 控制流組件

SolidJS 用組件替代 JSX 裏的 JavaScript 控制流，以確保細粒度追蹤：

```jsx
// Show：條件渲染（替代 &&）
<Show when={count() > 5} fallback={<p>Count 還不夠大</p>}>
  <p>Count 已經 > 5 了！</p>
</Show>

// For：列表渲染（替代 map）
<For each={items()} fallback={<p>列表為空</p>}>
  {(item, index) => <li>{index() + 1}. {item.name}</li>}
</For>

// Switch/Match：多條件分支
<Switch fallback={<p>未知狀態</p>}>
  <Match when={status() === 'loading'}><Spinner /></Match>
  <Match when={status() === 'error'}><ErrorMessage /></Match>
  <Match when={status() === 'success'}><Content /></Match>
</Switch>
```

## 性能為什麼這麼好

JS 框架性能測試（js-framework-benchmark）中，SolidJS 始終排名前列，接近原生 JavaScript：

| 框架     | 創建1000行 | 替換1000行 | 部分更新 |
| -------- | ---------- | ---------- | -------- |
| 原生 DOM | 1.0x       | 1.0x       | 1.0x     |
| SolidJS  | ~1.1x      | ~1.1x      | ~1.1x    |
| Vue 3    | ~1.3x      | ~1.5x      | ~1.6x    |
| React 17 | ~1.6x      | ~2.0x      | ~2.0x    |

原因：沒有虛擬 DOM diff，狀態變化直接轉化為精確的 DOM 操作。

## 總結

SolidJS 證明了"React 式 API + 細粒度響應式"是可行的。它不一定會取代 React 或 Vue，但它的設計思想正在影響整個生態——Vue 3 的 `@vue/reactivity` 和 Preact Signals 都有 SolidJS 的影子。2021 年值得用它做個小項目體驗一下。