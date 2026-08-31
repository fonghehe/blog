---
title: "React Concurrent Mode: A Deep Dive"
date: 2019-10-21 10:55:32
tags:
  - React
readingTime: 3
description: "React introduced the Fiber architecture in version 16.3, laying the groundwork for concurrent rendering. Concurrent Mode is an experimental feature the React team is still developing; it lets React prepare multiple versions of the UI at once, fundamentally improving the user experience. This article takes a deep look at how Concurrent Mode works and how to use it."
wordCount: 371
---

React introduced the Fiber architecture in version 16.3, laying the groundwork for concurrent rendering. Concurrent Mode is an experimental feature the React team is still developing; it lets React prepare multiple versions of the UI at once, fundamentally improving the user experience. This article takes a deep look at how Concurrent Mode works and how to use it.

## Why Concurrent Mode Is Needed

In traditional React rendering, once rendering starts it synchronously renders the entire component tree. For large apps, this can block the main thread for tens or even hundreds of milliseconds, leaving user interactions unresponsive:

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

Concurrent Mode lets React interrupt expensive rendering work to prioritize user interactions.

## Enabling Concurrent Mode

Concurrent Mode is currently experimental and requires a special API to create the root:

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

The most important companion feature of Concurrent Mode is Suspense, which can handle not only code splitting but also data loading:

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

`useTransition` is the most central Hook that Concurrent Mode provides. It lets you mark certain state updates as "transitions" (transition), which can then be interrupted:

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

### How `useTransition` Prioritizes Updates

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

`SuspenseList` controls the display order of multiple Suspense boundaries:

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

The possible values for `revealOrder`:

- `'forwards'`: show in order—each one appears only after the previous finishes loading
- `'backwards'`: reverse order
- `'together'`: show all together once everything has loaded

## Data Fetching Pattern with Cache

Combined with Suspense, this enables elegant data caching:

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

## Comparison with Traditional Mode

| Aspect | Traditional Mode | Concurrent Mode |
|--------|-----------------|----------------|
| Rendering | Synchronous, non-interruptible | Asynchronous, interruptible |
| User interaction | Blocked during rendering | Interactions are prioritized |
| Loading state | Each component manages its own | Unified via Suspense |
| Code splitting | React.lazy | React.lazy + Suspense |
| Data fetching | useEffect + setState | Suspense + resource reading |

## Current Status and Notes

Concurrent Mode is still experimental:

1. The API may still change
2. It's not recommended for production use
3. It requires the `react@experimental` build
4. Some third-party libraries may be incompatible

```bash
npm install react@experimental react-dom@experimental
```

## Summary

- Concurrent Mode lets React interrupt rendering to prioritize user interactions
- `useTransition` marks low-priority state updates
- Suspense centrally manages loading states, including data fetching
- `SuspenseList` controls the display order of multiple async components
- You enable it with the `createRoot` API
- It's still experimental, and the API may change
- It points to React's future direction: declarative, asynchronous UI
