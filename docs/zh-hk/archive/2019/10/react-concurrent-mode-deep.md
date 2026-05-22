---
title: "React Concurrent Mode 深入理解：落地路徑與實戰建議"
date: 2019-10-21 10:55:32
tags:
  - React
readingTime: 4
description: "React 在 16.3 版本引入了 Fiber 架構，為併發渲染打下了基礎。Concurrent Mode 是 React 團隊正在開發的一項實驗性功能，它讓 React 可以同時準備多個版本的 UI，從根本上改善用户體驗。本文將深入探討 Concurrent Mode 的工作原理和使用方式。"
wordCount: 611
---

React 在 16.3 版本引入了 Fiber 架構，為併發渲染打下了基礎。Concurrent Mode 是 React 團隊正在開發的一項實驗性功能，它讓 React 可以同時準備多個版本的 UI，從根本上改善用户體驗。本文將深入探討 Concurrent Mode 的工作原理和使用方式。

## 為什麼需要 Concurrent Mode

在傳統的 React 渲染模式下，一旦開始渲染，就會同步地完成整棵組件樹的渲染。對於大型應用，這個過程可能會阻塞主線程幾十甚至幾百毫秒，導致用户交互無響應：

```jsx
// 傳統模式下的問題
function SearchResults({ query }) {
  // 假設 results 有 10000 條數據
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

// 當用户在輸入框中輸入時
function App() {
  const [query, setQuery] = useState('');

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        // 每次輸入都需要等待 SearchResults 渲染完成
        // 輸入會出現明顯延遲
      />
      <SearchResults query={query} />
    </div>
  );
}
```

Concurrent Mode 允許 React 中斷耗時的渲染，優先處理用户交互。

## 開啓 Concurrent Mode

Concurrent Mode 目前是實驗性功能，需要使用特殊的 API 創建 Root：

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

// 傳統模式
// ReactDOM.render(<App />, document.getElementById('root'));

// Concurrent Mode
const root = ReactDOM.createRoot(
  document.getElementById('root')
);
root.render(<App />);
```

## Suspense for Data Fetching

Concurrent Mode 最重要的配套功能是 Suspense，它不僅可以處理代碼分割，還可以處理數據加載：

```jsx
import React, { Suspense } from 'react';

// 創建一個簡單的數據讀取器
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

// 創建用户數據資源
const userResource = createResource(() =>
  fetch('/api/user/1').then(res => res.json())
);

// 組件直接讀取數據，不處理加載狀態
function UserProfile() {
  // 如果數據未就緒，會拋出 Promise，由最近的 Suspense 捕獲
  const user = userResource.read();

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// 外層用 Suspense 包裹
function App() {
  return (
    <Suspense fallback={<div>加載用户信息...</div>}>
      <UserProfile />
    </Suspense>
  );
}
```

## useTransition

`useTransition` 是 Concurrent Mode 提供的最核心 Hook，它可以將某些狀態更新標記為"過渡"（transition），這些更新可以被中斷：

```jsx
import React, { useState, useTransition, Suspense } from 'react';

function App() {
  const [query, setQuery] = useState('');
  const [resource, setResource] = useState(null);

  // isPending 表示過渡是否還在進行中
  const [startTransition, isPending] = useTransition({
    timeoutMs: 3000
  });

  function handleSearch(e) {
    const value = e.target.value;

    // 立即更新輸入框（高優先級）
    setQuery(value);

    // 將搜索請求標記為過渡（低優先級）
    startTransition(() => {
      setResource(fetchSearchResults(value));
    });
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />

      {/* isPending 可以在加載期間顯示額外的 UI 反饋 */}
      {isPending && <Spinner />}

      <Suspense fallback={<div>搜索中...</div>}>
        {resource && <SearchResults resource={resource} />}
      </Suspense>
    </div>
  );
}
```

### useTransition 的優先級機製

```
用户輸入 "react"
  │
  ├─ 立即更新 input 值（高優先級，同步）
  │   輸入框立即顯示 "react"
  │
  └─ startTransition 更新搜索結果（低優先級，可中斷）
      React 可以中斷這個渲染來處理新的輸入
      渲染完成後顯示結果
```

## SuspenseList

`SuspenseList` 控製多個 Suspense 邊界的顯示順序：

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

`revealOrder` 的可選值：

- `'forwards'`：按順序顯示，前面的加載完才顯示後面的
- `'backwards'`：反向順序
- `'together'`：全部加載完一起顯示

## 帶緩存的數據獲取模式

結合 Suspense 可以實現優雅的數據緩存：

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

## 與傳統模式的對比

| 特性 | 傳統模式 | Concurrent Mode |
|
------|---------|----------------|
| 渲染方式 | 同步、不可中斷 | 異步、可中斷 |
| 用户交互 | 渲染期間阻塞 | 優先響應交互 |
| 加載狀態 | 各組件自行管理 | Suspense 統一管理 |
| 代碼分割 | React.lazy | React.lazy + Suspense |
| 數據獲取 | useEffect + setState | Suspense + 資源讀取 |

## 當前狀態與注意事項

Concurrent Mode 目前仍是實驗性功能：

1. API 可能會有變化
2. 不建議在生產環境使用
3. 需要 `react@experimental` 版本
4. 部分第三方庫可能不兼容

```bash
npm install react@experimental react-dom@experimental
```

## 小結

- Concurrent Mode 讓 React 可以中斷渲染，優先處理用户交互
- `useTransition` 標記低優先級的狀態更新
- Suspense 統一管理加載狀態，包括數據獲取
- `SuspenseList` 控製多個異步組件的顯示順序
- 需要使用 `createRoot` API 開啓
- 目前仍處於實驗階段，API 可能變化
- 代表了 React 未來的發展方向：聲明式異步 UI
