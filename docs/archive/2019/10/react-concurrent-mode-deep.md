---
title: "React Concurrent Mode 深入理解"
date: 2019-10-21 10:55:32
tags:
  - React
---

React 在 16.3 版本引入了 Fiber 架构，为并发渲染打下了基础。Concurrent Mode 是 React 团队正在开发的一项实验性功能，它让 React 可以同时准备多个版本的 UI，从根本上改善用户体验。本文将深入探讨 Concurrent Mode 的工作原理和使用方式。

## 为什么需要 Concurrent Mode

在传统的 React 渲染模式下，一旦开始渲染，就会同步地完成整棵组件树的渲染。对于大型应用，这个过程可能会阻塞主线程几十甚至几百毫秒，导致用户交互无响应：

```jsx
// 传统模式下的问题
function SearchResults({ query }) {
  // 假设 results 有 10000 条数据
  const results = expensiveFilter(query);

  return (
    <ul>
      {results.map(item => (
        <li key={item.id}>
          <ResultItem data={item} />
        </li>
      ))}
    </ul>
  );
}

// 当用户在输入框中输入时
function App() {
  const [query, setQuery] = useState('');

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        // 每次输入都需要等待 SearchResults 渲染完成
        // 输入会出现明显延迟
      />
      <SearchResults query={query} />
    </div>
  );
}
```

Concurrent Mode 允许 React 中断耗时的渲染，优先处理用户交互。

## 开启 Concurrent Mode

Concurrent Mode 目前是实验性功能，需要使用特殊的 API 创建 Root：

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

// 传统模式
// ReactDOM.render(<App />, document.getElementById('root'));

// Concurrent Mode
const root = ReactDOM.createRoot(
  document.getElementById('root')
);
root.render(<App />);
```

## Suspense for Data Fetching

Concurrent Mode 最重要的配套功能是 Suspense，它不仅可以处理代码分割，还可以处理数据加载：

```jsx
import React, { Suspense } from 'react';

// 创建一个简单的数据读取器
function createResource(fetcher) {
  let status = 'pending';
  let result;

  const promise = fetcher().then(
    data => {
      status = 'success';
      result = data;
    },
    error => {
      status = 'error';
      result = error;
    }
  );

  return {
    read() {
      if (status === 'pending') throw promise;
      if (status === 'error') throw result;
      if (status === 'success') return result;
    }
  };
}

// 创建用户数据资源
const userResource = createResource(() =>
  fetch('/api/user/1').then(res => res.json())
);

// 组件直接读取数据，不处理加载状态
function UserProfile() {
  // 如果数据未就绪，会抛出 Promise，由最近的 Suspense 捕获
  const user = userResource.read();

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// 外层用 Suspense 包裹
function App() {
  return (
    <Suspense fallback={<div>加载用户信息...</div>}>
      <UserProfile />
    </Suspense>
  );
}
```

## useTransition

`useTransition` 是 Concurrent Mode 提供的最核心 Hook，它可以将某些状态更新标记为"过渡"（transition），这些更新可以被中断：

```jsx
import React, { useState, useTransition, Suspense } from 'react';

function App() {
  const [query, setQuery] = useState('');
  const [resource, setResource] = useState(null);

  // isPending 表示过渡是否还在进行中
  const [startTransition, isPending] = useTransition({
    timeoutMs: 3000
  });

  function handleSearch(e) {
    const value = e.target.value;

    // 立即更新输入框（高优先级）
    setQuery(value);

    // 将搜索请求标记为过渡（低优先级）
    startTransition(() => {
      setResource(fetchSearchResults(value));
    });
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />

      {/* isPending 可以在加载期间显示额外的 UI 反馈 */}
      {isPending && <Spinner />}

      <Suspense fallback={<div>搜索中...</div>}>
        {resource && <SearchResults resource={resource} />}
      </Suspense>
    </div>
  );
}
```

### useTransition 的优先级机制

```
用户输入 "react"
  │
  ├─ 立即更新 input 值（高优先级，同步）
  │   输入框立即显示 "react"
  │
  └─ startTransition 更新搜索结果（低优先级，可中断）
      React 可以中断这个渲染来处理新的输入
      渲染完成后显示结果
```

## SuspenseList

`SuspenseList` 控制多个 Suspense 边界的显示顺序：

```jsx
import React, { Suspense, SuspenseList } from 'react';

function App() {
  return (
    <SuspenseList revealOrder="forwards">
      <Suspense fallback={<Spinner />}>
        <UserProfile />
      </Suspense>
      <Suspense fallback={<Spinner />}>
        <UserPosts />
      </Suspense>
      <Suspense fallback={<Spinner />}>
        <UserFollowers />
      </Suspense>
    </SuspenseList>
  );
}
```

`revealOrder` 的可选值：

- `'forwards'`：按顺序显示，前面的加载完才显示后面的
- `'backwards'`：反向顺序
- `'together'`：全部加载完一起显示

## 带缓存的数据获取模式

结合 Suspense 可以实现优雅的数据缓存：

```js
// cache.js
function createCache() {
  const cache = new Map();

  return {
    get(key, fetcher) {
      if (cache.has(key)) {
        const entry = cache.get(key);
        if (entry.status === 'pending') throw entry.promise;
        if (entry.status === 'error') throw entry.error;
        return entry.data;
      }

      const promise = fetcher(key).then(
        data => {
          cache.set(key, { status: 'success', data });
        },
        error => {
          cache.set(key, { status: 'error', error });
        }
      );

      cache.set(key, { status: 'pending', promise });
      throw promise;
    },

    invalidate(key) {
      cache.delete(key);
    }
  };
}

export const userCache = createCache();
```

```jsx
// UserCard.jsx
import { userCache } from './cache';

function fetchUser(id) {
  return fetch(`/api/users/${id}`).then(res => res.json());
}

function UserCard({ userId }) {
  const user = userCache.get(userId, fetchUser);

  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <h3>{user.name}</h3>
    </div>
  );
}
```

## 与传统模式的对比

| 特性 | 传统模式 | Concurrent Mode |
|------|---------|----------------|
| 渲染方式 | 同步、不可中断 | 异步、可中断 |
| 用户交互 | 渲染期间阻塞 | 优先响应交互 |
| 加载状态 | 各组件自行管理 | Suspense 统一管理 |
| 代码分割 | React.lazy | React.lazy + Suspense |
| 数据获取 | useEffect + setState | Suspense + 资源读取 |

## 当前状态与注意事项

Concurrent Mode 目前仍是实验性功能：

1. API 可能会有变化
2. 不建议在生产环境使用
3. 需要 `react@experimental` 版本
4. 部分第三方库可能不兼容

```bash
npm install react@experimental react-dom@experimental
```

## 小结

- Concurrent Mode 让 React 可以中断渲染，优先处理用户交互
- `useTransition` 标记低优先级的状态更新
- Suspense 统一管理加载状态，包括数据获取
- `SuspenseList` 控制多个异步组件的显示顺序
- 需要使用 `createRoot` API 开启
- 目前仍处于实验阶段，API 可能变化
- 代表了 React 未来的发展方向：声明式异步 UI
