---
title: "React 18 New Features Preview: Concurrent Features Are Here"
date: 2021-11-20 17:22:18
tags:
  - React
  - JavaScript

readingTime: 2
description: "React 18 Alpha is out and ready to try. The Concurrent features we've waited two years for are finally becoming official."
wordCount: 130
---

React 18 Alpha is out and ready to try. The Concurrent features we've been waiting two years for are finally going stable.

## Concurrent Rendering

The core change in React 18: rendering becomes a process that can be interrupted and resumed.

```javascript
// React 17：同步渲染
import ReactDOM from "react-dom";
ReactDOM.render(<App />, document.getElementById("root"));

// React 18：并发渲染
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(<App />);
```

It's just this one-line change, yet it unlocks many concurrent features.

## Automatic Batching

```javascript
// React 17：只有 React 事件处理中才批处理
function handleClick() {
  setCount((c) => c + 1); // 单独渲染
  setName("Alice"); // 单独渲染
  // 两次 setState → 两次渲染
}

// Promise/setTimeout 中不批处理
setTimeout(() => {
  setCount((c) => c + 1); // 渲染 1 次
  setName("Alice"); // 渲染 1 次
  // 两次 setState → 两次渲染！
});

// React 18：所有地方都自动批处理
setTimeout(() => {
  setCount((c) => c + 1);
  setName("Alice");
  // 只渲染 1 次！
});
```

No code changes are required; performance improves automatically.

## useTransition

```javascript
import { useState, useTransition } from "react";

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e) {
    // 紧急更新：输入框立即响应
    setQuery(e.target.value);

    // 非紧急（可被打断的）更新
    startTransition(() => {
      const newResults = searchData(e.target.value);
      setResults(newResults);
    });
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      {isPending && <Spinner />}
      <ResultList results={results} />
    </div>
  );
}
```

User input stays smooth; updating search results never blocks typing.

## useDeferredValue

```javascript
import { useState, useDeferredValue } from "react";

function App() {
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);

  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      {/* 使用延迟值，不会阻塞 input 响应 */}
      <HeavyList text={deferredText} />
    </>
  );
}
```

## Suspense Improvements

```javascript
// React 18：Suspense 支持服务端渲染（SSR）
// 页面可以分段流式渲染，不需要等所有数据准备好

function ProfilePage() {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>

      <Suspense fallback={<PostsSkeleton />}>
        <Posts /> {/* 可以独立加载，不需要等 Header */}
      </Suspense>

      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </div>
  );
}
// 流式 SSR：先发送 HTML 骨架，数据准备好了再流式填充
```

## useId

```javascript
import { useId } from 'react'

// 生成唯一 ID（服务端客户端一致，解决 SSR hydration 不匹配问题）
function FormField({ label, type }) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} />
    </div>
  )
}

// ✅ 多次使用同一组件，ID 不会冲突
<FormField label="姓名" type="text" />    // id: :r0:
<FormField label="邮箱" type="email" />   // id: :r1:
```

## Upgrade Notes

```javascript
// createRoot 替换 ReactDOM.render（必须的）
// 但在 React 18 中，ReactDOM.render 仍然可用（兼容模式，不开启并发特性）

// 如果用了 useEffect 的副作用，React 18 StrictMode 会执行两次
// 用于检测不纯的副作用（开发模式）
// 生产模式不受影响
```

## Summary

- Automatic Batching is the most practical improvement in React 18, requiring no code changes
- useTransition: distinguishes urgent from non-urgent updates to keep the UI responsive
- Suspense SSR: streaming rendering lets users see content faster
- useId: generates unique IDs consistent between SSR and CSR
- The stable release is expected in early 2022
