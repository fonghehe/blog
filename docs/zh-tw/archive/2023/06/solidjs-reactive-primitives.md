---
title: "Solid.js：細粒度響應式的另一種答案"
date: 2023-06-22 09:48:23
tags:
  - React
readingTime: 3
description: "React 有虛擬 DOM diff，Vue 有 Proxy 響應式，Solid 選擇了第三條路：編譯時 + 細粒度訊號。這個框架值得前端架構師瞭解。"
wordCount: 494
---

React 有虛擬 DOM diff，Vue 有 Proxy 響應式，Solid 選擇了第三條路：編譯時 + 細粒度訊號。這個框架值得前端架構師瞭解。

## 核心理念

Solid 的設計哲學：**沒有虛擬 DOM**。響應式系統追蹤的是"哪個表示式依賴哪個狀態"，狀態變化時直接更新對應的 DOM 節點，不需要 diff 整棵樹。

```jsx
import { createSignal, createEffect } from "solid-js";

function Counter() {
  const [count, setCount] = createSignal(0);

  // createEffect 自動追蹤 count() 的依賴
  createEffect(() => {
    console.log("count:", count());
  });

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      點選了 {count()} 次
    </button>
  );
}
```

注意 `count` 是一個**函式**，不是值。這是 Solid 和 React/Vue 最大的區別。呼叫 `count()` 才讀取值，這讓依賴追蹤變得精確。

## 和 React 的對比

```jsx
// React: 每次狀態變化，整個元件函式重新執行
function Counter() {
  const [count, setCount] = useState(0);
  // 這行在每次渲染都執行
  console.log("rendered");
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// Solid: 元件函式只執行一次，後續只有 DOM 更新
function Counter() {
  const [count, setCount] = createSignal(0);
  // 這行只在初始化時執行一次
  console.log("created");
  return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
}
```

沒有閉包陷阱，沒有 `useCallback`、`useMemo` 之類的最佳化 hooks。因為元件函式不重新執行，所以不存在"舊閉包引用"的問題。

## 效能表現

```
JS Framework Benchmark（Chrome 118）:

建立 1000 行：
  Solid:    1.20
  Vue 3:    1.48
  Svelte 4: 1.35
  React 18: 1.78
  （越低越好，相對 vanilla JS）

替換 1000 行：
  Solid:    1.25
  React 18: 2.10

部分更新：
  Solid:    1.10
  React 18: 1.95
```

在大部分測試項中 Solid 排名第一或接近第一。這是因為它的更新粒度是最細的——改一個數字就只更新那個文本節點。

## 響應式原語

```jsx
import {
  createSignal,
  createEffect,
  createMemo,
  createResource,
  onCleanup,
} from "solid-js";

function UserProfile({ userId }) {
  // 派生狀態
  const doubleCount = createMemo(() => count() * 2);

  // 非同步資料獲取
  const [user] = createResource(userId, async (id) => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  });

  // 副作用 + 清理
  createEffect(() => {
    const timer = setInterval(() => {
      console.log("tick", count());
    }, 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <div>
      <Show when={!user.loading} fallback={<div>Loading...</div>}>
        <h1>{user().name}</h1>
      </Show>
    </div>
  );
}
```

`createSignal`、`createMemo`、`createEffect` 對標 React 的 `useState`、`useMemo`、`useEffect`，但語義更清晰——沒有依賴陣列，沒有 stale closure 問題。

## 控制流元件

```jsx
import { Show, For, Switch, Match } from "solid-js";

function UserList({ users, filter }) {
  return (
    <div>
      {/* 條件渲染 */}
      <Show when={users().length > 0} fallback={<p>沒有使用者</p>}>
        {/* 列表渲染 */}
        <For each={users()}>
          {(user) => (
            <div>
              <span>{user.name}</span>
              {/* 巢狀條件 */}
              <Switch>
                <Match when={user.role === "admin"}>
                  <Badge color="red">管理員</Badge>
                </Match>
                <Match when={user.role === "editor"}>
                  <Badge color="blue">編輯</Badge>
                </Match>
              </Switch>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
```

`For` 元件做精確的列表 diff，而不是每次重建整個列表。

## 什麼時候考慮 Solid

**適合：**
- 效能敏感的互動介面（即時資料儀表盤、線上編輯器）
- 需要精細控制更新的場景
- 團隊願意學習新範式

**不適合：**
- 需要豐富的第三方元件庫
- 大型團隊協作（生態和工具鏈還在成長）
- 依賴大量 React 生態的專案

## 小結

- Solid 的細粒度響應式是目前效能最好的前端框架之一
- 沒有虛擬 DOM diff，更新直接操作真實 DOM
- `createSignal` 訊號系統避免了 React 的閉包陷阱和 stale reference 問題
- 生態系統在成長但還不夠豐富，適合效能關鍵場景
- 值得作為架構師的知識儲備，即使不直接用於生產