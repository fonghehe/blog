---
title: "React Concurrent Mode 初探"
date: 2019-05-27 16:57:55
tags:
  - React
readingTime: 2
description: "React 團隊在 React Conf 2019 上展示了 Concurrent Mode 的更多細節。這是 React 16.8 Hooks 之後最重要的特性，但正式版可能要等到 2020 年。"
wordCount: 282
---

React 團隊在 React Conf 2019 上展示了 Concurrent Mode 的更多細節。這是 React 16.8 Hooks 之後最重要的特性，但正式版可能要等到 2020 年。

## Concurrent Mode 解決什麼問題

同步渲染的問題：React 開始渲染就不能被打斷，渲染大型元件樹時主執行緒被阻塞，使用者互動無響應。

```javascript
// 傳統同步渲染
// 開始渲染 → 渲染完成（中間使用者點選無響應）
ReactDOM.render(<App />, document.getElementById("root"));

// Concurrent Mode：渲染可以被打斷
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
// 渲染過程中可以響應使用者輸入，高優先順序任務可以打斷低優先順序渲染
```

## Suspense：資料獲取的非同步化

```jsx
// 之前的 Loading 模式（每個元件管理自己的 loading 狀態）
function UserProfile({ id }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(id).then((user) => {
      setUser(user);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Spinner />;
  return <div>{user.name}</div>;
}

// Suspense 模式（元件只關心資料，Loading 在父層統一處理）
function UserProfile({ id }) {
  // 假設 user 是通過 Suspense 相容的 API 獲取的
  const user = userResource.read(id); // 如果沒準備好，丟擲 Promise
  return <div>{user.name}</div>;
}

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile id="123" />
    </Suspense>
  );
}
```

## useTransition：區分緊急和非緊急更新

```jsx
import { useState, useTransition } from "react";

function SearchResults() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    // 緊急更新：立即顯示輸入的字元
    setQuery(e.target.value);

    // 非緊急更新：可以被打斷的搜尋結果更新
    startTransition(() => {
      const searchResults = performExpensiveSearch(e.target.value);
      setResults(searchResults);
    });
  }

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending ? <Spinner /> : null}
      <ResultList results={results} />
    </div>
  );
}
```

## useDeferredValue

```jsx
import { useState, useDeferredValue } from "react";

function App() {
  const [text, setText] = useState("");

  // 延遲值：在 UI 響應緊急更新後，再更新這個值
  const deferredText = useDeferredValue(text);

  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      {/* 這個列表用延遲值，不會阻塞 input */}
      <HeavyList query={deferredText} />
    </>
  );
}
```

## 2019 年的狀態

Concurrent Mode 在 2019 年還在實驗階段：

- 不穩定的 API（正式版 API 可能會變）
- 只在 `ReactDOM.createRoot` 中啟用
- 依賴 Suspense 的資料獲取庫還不成熟（relay、swr 在跟進）

預計 2020-2021 年才會穩定。現在瞭解概念，為以後做準備。

## 小結

- Concurrent Mode：渲染可中斷，高優先順序任務可打斷低優先順序渲染
- Suspense：統一處理非同步載入狀態，元件更純粹
- useTransition：區分緊急和非緊急狀態更新
- useDeferredValue：延遲非緊急值更新，類似 debounce 但更聰明
- 2019 年還是實驗特性，生產專案謹慎使用
