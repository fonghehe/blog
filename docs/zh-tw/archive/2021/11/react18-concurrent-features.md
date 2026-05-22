---
title: "React 18 新特性預覽：併發特性正式來了"
date: 2021-11-20 17:22:18
tags:
  - React
  - JavaScript
readingTime: 2
description: "React 18 Alpha 已經發布，可以試用了。等了兩年的 Concurrent 特性終於要正式了。"
wordCount: 202
---

React 18 Alpha 已經發布，可以試用了。等了兩年的 Concurrent 特性終於要正式了。

## 併發渲染（Concurrent Rendering）

React 18 的核心變化：渲染變成可以被打斷、恢復的過程。

```javascript
// React 17：同步渲染
import ReactDOM from "react-dom";
ReactDOM.render(<App />, document.getElementById("root"));

// React 18：併發渲染
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(<App />);
```

隻是這一行變化，但開啟了很多併發特性。

## Automatic Batching（自動批處理）

```javascript
// React 17：隻有 React 事件處理中才批處理
function handleClick() {
  setCount((c) => c + 1); // 單獨渲染
  setName("Alice"); // 單獨渲染
  // 兩次 setState → 兩次渲染
}

// Promise/setTimeout 中不批處理
setTimeout(() => {
  setCount((c) => c + 1); // 渲染 1 次
  setName("Alice"); // 渲染 1 次
  // 兩次 setState → 兩次渲染！
});

// React 18：所有地方都自動批處理
setTimeout(() => {
  setCount((c) => c + 1);
  setName("Alice");
  // 隻渲染 1 次！
});
```

不需要任何程式碼改動，效能自動提升。

## useTransition

```javascript
import { useState, useTransition } from "react";

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e) {
    // 緊急更新：輸入框立即響應
    setQuery(e.target.value);

    // 非緊急（可被打斷的）更新
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

使用者輸入始終流暢，搜尋結果更新不會阻塞輸入。

## useDeferredValue

```javascript
import { useState, useDeferredValue } from "react";

function App() {
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);

  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      {/* 使用延遲值，不會阻塞 input 響應 */}
      <HeavyList text={deferredText} />
    </>
  );
}
```

## Suspense 改進

```javascript
// React 18：Suspense 支援服務端渲染（SSR）
// 頁面可以分段流式渲染，不需要等所有資料準備好

function ProfilePage() {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>

      <Suspense fallback={<PostsSkeleton />}>
        <Posts /> {/* 可以獨立載入，不需要等 Header */}
      </Suspense>

      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </div>
  );
}
// 流式 SSR：先發送 HTML 骨架，資料準備好了再流式填充
```

## useId

```javascript
import { useId } from 'react'

// 生成唯一 ID（服務端客戶端一致，解決 SSR hydration 不匹配問題）
function FormField({ label, type }) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} />
    </div>
  )
}

// ✅ 多次使用同一組件，ID 不會衝突
<FormField label="姓名" type="text" />    // id: :r0:
<FormField label="郵箱" type="email" />   // id: :r1:
```

## 升級注意事項

```javascript
// createRoot 替換 ReactDOM.render（必須的）
// 但在 React 18 中，ReactDOM.render 仍然可用（相容模式，不開啟併發特性）

// 如果用了 useEffect 的副作用，React 18 StrictMode 會執行兩次
// 用於檢測不純的副作用（開發模式）
// 生產模式不受影響
```

## 小結

- Automatic Batching 是 React 18 最實際的改進，不需要改程式碼
- useTransition：區分緊急/非緊急更新，保持 UI 響應
- Suspense SSR：流式渲染，使用者更快看到內容
- useId：SSR 和 CSR 一致的唯一 ID
- 正式版預計 2022 年初發布