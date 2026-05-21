---
title: "Solid.js：細粒度リアクティビティのもう一つの答え"
date: 2023-06-22 09:48:23
tags:
  - React
readingTime: 3
description: "React 有虚拟 DOM diff，Vue 有 Proxy 响应式，Solid 选择了第三条路：编译时 + 细粒度信号。这个框架值得前端架构师了解。"
wordCount: 517
---

React 有虚拟 DOM diff，Vue 有 Proxy 响应式，Solid 选择了第三条路：编译时 + 细粒度信号。这个框架值得前端架构师了解。

## コア理念

Solid 的设计哲学：**没有虚拟 DOM**。响应式系统追踪的是"哪个表达式依赖哪个状态"，状态变化时直接更新对应的 DOM 节点，不需要 diff 整棵树。

```jsx
import { createSignal, createEffect } from "solid-js";

function Counter() {
  const [count, setCount] = createSignal(0);

  // createEffect 自动追踪 count() 的依赖
  createEffect(() => {
    console.log("count:", count());
  });

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      点击了 {count()} 次
    </button>
  );
}
```

注意 `count` 是一个**函数**，不是值。这是 Solid 和 React/Vue 最大的区别。调用 `count()` 才读取值，这让依赖追踪变得精确。

## React との比較

```jsx
// React: 每次状态变化，整个组件函数重新执行
function Counter() {
  const [count, setCount] = useState(0);
  // 这行在每次渲染都执行
  console.log("rendered");
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// Solid: 组件函数只执行一次，后续只有 DOM 更新
function Counter() {
  const [count, setCount] = createSignal(0);
  // 这行只在初始化时执行一次
  console.log("created");
  return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
}
```

没有闭包陷阱，没有 `useCallback`、`useMemo` 之类的优化 hooks。因为组件函数不重新执行，所以不存在"旧闭包引用"的问题。

## パフォーマンス特性

```
JS Framework Benchmark（Chrome 118）:

创建 1000 行：
  Solid:    1.20
  Vue 3:    1.48
  Svelte 4: 1.35
  React 18: 1.78
  （越低越好，相对 vanilla JS）

替换 1000 行：
  Solid:    1.25
  React 18: 2.10

部分更新：
  Solid:    1.10
  React 18: 1.95
```

在大部分测试项中 Solid 排名第一或接近第一。这是因为它的更新粒度是最细的——改一个数字就只更新那个文本节点。

## リアクティブプリミティブ

```jsx
import {
  createSignal,
  createEffect,
  createMemo,
  createResource,
  onCleanup,
} from "solid-js";

function UserProfile({ userId }) {
  // 派生状态
  const doubleCount = createMemo(() => count() * 2);

  // 异步数据获取
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

`createSignal`、`createMemo`、`createEffect` 对标 React 的 `useState`、`useMemo`、`useEffect`，但语义更清晰——没有依赖数组，没有 stale closure 问题。

## 制御フローコンポーネント

```jsx
import { Show, For, Switch, Match } from "solid-js";

function UserList({ users, filter }) {
  return (
    <div>
      {/* 条件渲染 */}
      <Show when={users().length > 0} fallback={<p>没有用户</p>}>
        {/* 列表渲染 */}
        <For each={users()}>
          {(user) => (
            <div>
              <span>{user.name}</span>
              {/* 嵌套条件 */}
              <Switch>
                <Match when={user.role === "admin"}>
                  <Badge color="red">管理员</Badge>
                </Match>
                <Match when={user.role === "editor"}>
                  <Badge color="blue">编辑</Badge>
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

`For` 组件做精确的列表 diff，而不是每次重建整个列表。

## Solid を検討するタイミング

**适合：**
- 性能敏感的交互界面（实时数据仪表盘、在线编辑器）
- 需要精细控制更新的场景
- 团队愿意学习新范式

**不适合：**
- 需要丰富的第三方组件库
- 大型团队协作（生态和工具链还在成长）
- 依赖大量 React 生态的项目

## まとめ

- Solid 的细粒度响应式是目前性能最好的前端框架之一
- 没有虚拟 DOM diff，更新直接操作真实 DOM
- `createSignal` 信号系统避免了 React 的闭包陷阱和 stale reference 问题
- 生态系统在成长但还不够丰富，适合性能关键场景
- 值得作为架构师的知识储备，即使不直接用于生产