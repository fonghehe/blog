---
title: "Solid.js：React 思維，原生性能"
date: 2022-07-12 16:06:23
tags:
  - 前端
readingTime: 3
description: "Solid.js 1.0 已經發布一年了，是時候認真體驗一下。它的 JSX 寫法和 React 幾乎一樣，但沒有虛擬 DOM、沒有 Diff、沒有 Fiber——響應式更新直接操作真實 DOM。"
---

Solid.js 1.0 已經發布一年了，是時候認真體驗一下。它的 JSX 寫法和 React 幾乎一樣，但沒有虛擬 DOM、沒有 Diff、沒有 Fiber——響應式更新直接操作真實 DOM。

## 為什麼關注 Solid

React 的虛擬 DOM 模式帶來了一個根本問題：每次狀態變化，整個子樹都要重新執行 render 函數，再通過 Diff 找出變化的部分。Solid 的答案是：不需要。

```jsx
// Solid.js
import { createSignal, For } from 'solid-js';

function Counter() {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <p>計數: {count()}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

注意：`count` 是一個函數，需要 `count()` 獲取值。這是 Solid 和 React 最大的區別——沒有自動重新執行組件函數。

## 核心概念：createSignal

```jsx
import { createSignal, createEffect } from 'solid-js';

function App() {
  const [name, setName] = createSignal('World');
  const [greeting, setGreeting] = createSignal('Hello');

  // createEffect 只在依賴變化時執行
  createEffect(() => {
    console.log(`當前問候: ${greeting()}, ${name()}`);
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

`createEffect` 類似 React 的 `useEffect`，但它自動追蹤依賴（不需要依賴數組），且只在信號變化時重新執行。

## 組件只執行一次

```jsx
function Parent() {
  const [count, setCount] = createSignal(0);

  // 這個 console.log 只在初始渲染時執行一次！
  console.log('Parent 渲染');

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <Child count={count()} />
    </div>
  );
}

function Child(props) {
  // Child 也只在初始渲染時執行一次
  console.log('Child 渲染');

  return <span>{props.count}</span>;
}
```

點按鈕時，`Parent` 和 `Child` 的函數體不會重新執行。Solid 直接更新 `<span>` 的文本節點。

## createStore：複雜狀態管理

```jsx
import { createStore, produce } from 'solid-js';

function TodoApp() {
  const [state, setState] = createStore({
    todos: [
      { id: 1, text: '學 Solid', done: false },
      { id: 2, text: '寫博客', done: false },
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

`createStore` 是嵌套的響應式對象，路徑式更新——只有變化的部分會觸發 DOM 更新。

## 控制流組件

```jsx
import { Show, For, Switch, Match, Suspense } from 'solid-js';

function UserProfile({ user }) {
  return (
    <Show when={user()} fallback={<div>加載中...</div>}>
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

這些不是普通的 if/for——Solid 的 `<For>` 使用 DOM 節點複用，不需要 key。

## 與 React 的對比

| 特性 | React | Solid |
|
------|-------|-------|
| 更新粒度 | 組件 | 精確 DOM 節點 |
| 虛擬 DOM | 有 | 沒有 |
| 組件執行 | 每次更新都重跑 | 只執行一次 |
| 依賴追蹤 | 依賴數組（手動） | 自動追蹤 |
| Hooks 規則 | 有（不能條件調用） | 沒有 |
| 學習曲線 | 中 | 低（如果會 React） |

## 實際性能

```
JS Framework Benchmark（越低越好）：

React 18:     1.24
Vue 3:        1.08
Solid 1.0:    1.02
Vanilla JS:   1.00
```

Solid 的性能接近原生 JS，在所有框架中最快。

## 小結

Solid.js 值得每個 React 開發者體驗。它證明了 JSX 和響應式不一定要依賴虛擬 DOM。對於性能敏感的場景（大數據表格、實時數據流），Solid 是一個嚴肅的選擇。但生態和社區還遠不如 React，工具鏈和組件庫需要時間成熟。