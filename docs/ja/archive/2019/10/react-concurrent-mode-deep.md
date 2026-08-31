---
title: "React Concurrent Mode 深掘り理解"
date: 2019-10-21 10:55:32
tags:
  - React
readingTime: 5
description: "React 在 16.3 版本引入了 Fiber 架构，为并发渲染打下了基础。Concurrent Mode 是 React 团队正在开发的一项实验性功能，它让 React 可以同时准备多个版本的 UI，从根本上改善用户体验。本文将深入探讨 Concurrent Mode 的工作原理和使用方式。"
wordCount: 944
---

React は 16.3 で Fiber アーキテクチャを導入し、並行レンダリングの基礎を築きました。Concurrent Mode は React チームが開発中の実験的な機能であり、React が複数バージョンの UI を同時に準備し、根本からユーザー体験を改善できるようにします。本記事では Concurrent Mode の仕組みと使い方を深く掘り下げます。

## Concurrent Modeが必要な理由

従来の React レンダリングモードでは、一度レンダリングを始めると、コンポーネントツリー全体を同期して完了させます。大規模なアプリではこの処理がメインスレッドを数十ミリ秒から数百ミリ秒阻塞し、ユーザーの操作に反応しなくなることがあります：

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

Concurrent Mode は React が時間のかかるレンダリングを中断し、ユーザー操作を優先できるようにします。

## Concurrent Modeを有効にする

Concurrent Mode は現在実験的な機能であり、特別な API で Root を作成する必要があります：

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

## データフェッチ用Suspense

Concurrent Mode で最も重要な付随機能は Suspense であり、コード分割だけでなくデータの読み込みも扱えます：

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

`useTransition` は Concurrent Mode が提供する最も中核的な Hook であり、一部の状態更新を「トランジション（transition）」としてマークでき、その更新は中断可能です：

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

### useTransition の優先順位メカニズム

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

`revealOrder` に指定できる値は以下のとおりです：

- `'forwards'`：順番に表示し、前のものが読み込み終わってから後ろを表示する
- `'backwards'`：逆順
- `'together'`：すべて読み込み終わってからまとめて表示

## キャッシュ付きデータ取得パターン

Suspense と組み合わせることで、洗練されたデータキャッシュを実現できます：

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

## 従来モードとの比較

| 特性 | 従来のモード | Concurrent Mode |
|------|-------------|----------------|
| レンダリング方式 | 同期、中断不可 | 非同期、中断可能 |
| ユーザー操作 | レンダリング中はブロック | 操作を優先して応答 |
| ロード状態 | 各コンポーネントが個別管理 | Suspense が一元管理 |
| コード分割 | React.lazy | React.lazy + Suspense |
| データ取得 | useEffect + setState | Suspense + リソース読み取り |

## 現在の状態と注意事項

Concurrent Mode は現在も実験的な機能です：

1. API は変わる可能性がある
2. 本番環境での使用は推奨されない
3. `react@experimental` バージョンが必要
4. 一部のサードパーティライブラリと非互換の可能性がある

```bash
npm install react@experimental react-dom@experimental
```

## まとめ

- Concurrent Mode は React がレンダリングを中断し、ユーザー操作を優先できるようにする
- `useTransition` は低優先度の状態更新をマークする
- Suspense はデータ取得を含め、ロード状態を一元管理する
- `SuspenseList` は複数の非同期コンポーネントの表示順を制御する
- 有効化には `createRoot` API を使う必要がある
- 現在も実験段階にあり、API は変わる可能性がある
- React の将来の方向性、すなわち宣言的な非同期 UI を象徴している
