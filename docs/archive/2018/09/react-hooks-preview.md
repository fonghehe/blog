---
title: "React Hooks 来了：useState 和 useEffect 初体验"
date: 2018-09-12 17:05:13
tags:
  - React
readingTime: 3
description: "上个月 React 团队提出了 Hooks 的 RFC，昨天试了一下，感觉这是 React 生态最大的改变之一。"
---

上个月 React 团队提出了 Hooks 的 RFC，昨天试了一下，感觉这是 React 生态最大的改变之一。

> **注意**：React Hooks 目前（2018年9月）还是 RFC 阶段，API 可能还会变化。预计在 React 16.7 alpha 中可以体验。

## Hooks 要解决的问题

在 Hooks 之前，有几个长期存在的痛点：

1. **逻辑复用难**：要在多个组件间共享有状态的逻辑，需要 HOC 或 render props，嵌套层级深
2. **复杂组件难理解**：生命周期分散了相关的逻辑（比如订阅和取消订阅分散在 componentDidMount 和 componentWillUnmount）
3. **class 的 this 让人困惑**：新手经常忘记绑定 this

Hooks 让函数组件也能有状态和副作用。

## useState：状态 Hook

```javascript
import React, { useState } from "react";

// 之前：需要 class
class Counter extends React.Component {
  state = { count: 0 };

  render() {
    return (
      <button onClick={() => this.setState({ count: this.state.count + 1 })}>
        Count: {this.state.count}
      </button>
    );
  }
}

// Hooks：函数组件也能有状态
function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

`useState` 返回 `[当前值, 更新函数]` 的数组，用解构赋值接收。

```javascript
// 多个状态
function UserForm() {
  const [name, setName] = useState("");
  const [age, setAge] = useState(0);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    await saveUser({ name, age });
    setLoading(false);
  }

  return (
    <form onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input value={age} onChange={(e) => setAge(Number(e.target.value))} />
      <button disabled={loading}>{loading ? "保存中..." : "保存"}</button>
    </form>
  );
}
```

## useEffect：副作用 Hook

```javascript
import React, { useState, useEffect } from "react";

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // useEffect 在渲染后执行，相当于 componentDidMount + componentDidUpdate
  useEffect(() => {
    setLoading(true);

    fetchUser(userId).then((data) => {
      setUser(data);
      setLoading(false);
    });

    // 返回的函数在下次 effect 执行前或组件卸载时调用
    // 相当于 componentWillUnmount
    return () => {
      // 清理：取消请求、清除订阅等
    };
  }, [userId]); // 依赖数组：只有 userId 变化时才重新执行

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

**依赖数组的规则：**

```javascript
useEffect(() => {
  // 每次渲染后都执行
});

useEffect(() => {
  // 只在 mount 时执行一次（相当于 componentDidMount）
}, []);

useEffect(() => {
  // userId 或 type 变化时执行
}, [userId, type]);
```

## 自定义 Hook：逻辑复用

这是 Hooks 最强大的地方——可以把有状态的逻辑抽取成可复用的函数：

```javascript
// 自定义 Hook：封装数据获取逻辑
function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}

// 在多个组件中复用
function UserProfile({ userId }) {
  const { user, loading } = useUser(userId);
  if (loading) return <Spinner />;
  return <div>{user.name}</div>;
}

function UserAvatar({ userId }) {
  const { user } = useUser(userId);
  return <img src={user?.avatar} alt={user?.name} />;
}
```

比 HOC 嵌套或 render props 清晰多了！

## 和 Vue 3 Composition API 的对比

听说 Vue 3 也在考虑类似的 Composition API，和 Hooks 有很多相似的设计思路。两者都是：

- 把相关逻辑放在一起，而非分散在生命周期
- 支持逻辑复用，不需要嵌套

```javascript
// Vue 3 Composition API（预览，2018年还没有）
export default {
  setup() {
    const count = ref(0);
    const increment = () => count.value++;

    onMounted(() => {
      console.log("mounted");
    });

    return { count, increment };
  },
};
```

## 目前的状态

React Hooks 目前处于 RFC 阶段，React 核心团队在征求社区反馈。如果感兴趣：

- RFC 地址：https://github.com/reactjs/rfcs
- Dan Abramov 的介绍文章和视频值得看

预计会在年底或明年发布稳定版。我个人觉得这个方向是对的，比 HOC/render props 优雅得多。

## 小结

- `useState` 让函数组件有状态
- `useEffect` 处理副作用（数据获取、订阅、DOM 操作）
- 自定义 Hook 让有状态逻辑可以像函数一样复用
- 目前还是 RFC，正式发布前 API 可能变化
