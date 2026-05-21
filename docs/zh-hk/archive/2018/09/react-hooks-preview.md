---
title: "React Hooks 來了：useState 和 useEffect 初體驗"
date: 2018-09-12 17:05:13
tags:
  - React
readingTime: 3
description: "上個月 React 團隊提出了 Hooks 的 RFC，昨天試了一下，感覺這是 React 生態最大的改變之一。"
wordCount: 493
---

上個月 React 團隊提出了 Hooks 的 RFC，昨天試了一下，感覺這是 React 生態最大的改變之一。

> **注意**：React Hooks 目前（2018年9月）還是 RFC 階段，API 可能還會變化。預計在 React 16.7 alpha 中可以體驗。

## Hooks 要解決的問題

在 Hooks 之前，有幾個長期存在的痛點：

1. **邏輯複用難**：要在多個組件間共享有狀態的邏輯，需要 HOC 或 render props，嵌套層級深
2. **複雜組件難理解**：生命週期分散了相關的邏輯（比如訂閲和取消訂閲分散在 componentDidMount 和 componentWillUnmount）
3. **class 的 this 讓人困惑**：新手經常忘記綁定 this

Hooks 讓函數組件也能有狀態和副作用。

## useState：狀態 Hook

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

// Hooks：函數組件也能有狀態
function Counter() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

`useState` 返回 `[當前值, 更新函數]` 的數組，用解構賦值接收。

```javascript
// 多個狀態
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

  // useEffect 在渲染後執行，相當於 componentDidMount + componentDidUpdate
  useEffect(() => {
    setLoading(true);

    fetchUser(userId).then((data) => {
      setUser(data);
      setLoading(false);
    });

    // 返回的函數在下次 effect 執行前或組件卸載時調用
    // 相當於 componentWillUnmount
    return () => {
      // 清理：取消請求、清除訂閲等
    };
  }, [userId]); // 依賴數組：只有 userId 變化時才重新執行

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return <div>{user.name}</div>;
}
```

**依賴數組的規則：**

```javascript
useEffect(() => {
  // 每次渲染後都執行
});

useEffect(() => {
  // 只在 mount 時執行一次（相當於 componentDidMount）
}, []);

useEffect(() => {
  // userId 或 type 變化時執行
}, [userId, type]);
```

## 自定義 Hook：邏輯複用

這是 Hooks 最強大的地方——可以把有狀態的邏輯抽取成可複用的函數：

```javascript
// 自定義 Hook：封裝數據獲取邏輯
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

// 在多個組件中複用
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

## 和 Vue 3 Composition API 的對比

聽説 Vue 3 也在考慮類似的 Composition API，和 Hooks 有很多相似的設計思路。兩者都是：

- 把相關邏輯放在一起，而非分散在生命週期
- 支持邏輯複用，不需要嵌套

```javascript
// Vue 3 Composition API（預覽，2018年還沒有）
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

## 目前的狀態

React Hooks 目前處於 RFC 階段，React 核心團隊在徵求社區反饋。如果感興趣：

- RFC 地址：https://github.com/reactjs/rfcs
- Dan Abramov 的介紹文章和視頻值得看

預計會在年底或明年發佈穩定版。我個人覺得這個方向是對的，比 HOC/render props 優雅得多。

## 小結

- `useState` 讓函數組件有狀態
- `useEffect` 處理副作用（數據獲取、訂閲、DOM 操作）
- 自定義 Hook 讓有狀態邏輯可以像函數一樣複用
- 目前還是 RFC，正式發佈前 API 可能變化
