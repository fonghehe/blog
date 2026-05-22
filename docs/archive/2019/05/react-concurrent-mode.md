---
title: "React Concurrent Mode 初探：时间切片与 Suspense 实验"
date: 2019-05-27 16:57:55
tags:
  - React
readingTime: 2
description: "React 团队在 React Conf 2019 上展示了 Concurrent Mode 的更多细节。这是 React 16.8 Hooks 之后最重要的特性，但正式版可能要等到 2020 年。"
wordCount: 276
---

React 团队在 React Conf 2019 上展示了 Concurrent Mode 的更多细节。这是 React 16.8 Hooks 之后最重要的特性，但正式版可能要等到 2020 年。

## Concurrent Mode 解决什么问题

同步渲染的问题：React 开始渲染就不能被打断，渲染大型组件树时主线程被阻塞，用户交互无响应。

```javascript
// 传统同步渲染
// 开始渲染 → 渲染完成（中间用户点击无响应）
ReactDOM.render(<App />, document.getElementById("root"));

// Concurrent Mode：渲染可以被打断
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
// 渲染过程中可以响应用户输入，高优先级任务可以打断低优先级渲染
```

## Suspense：数据获取的异步化

```jsx
// 之前的 Loading 模式（每个组件管理自己的 loading 状态）
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

// Suspense 模式（组件只关心数据，Loading 在父层统一处理）
function UserProfile({ id }) {
  // 假设 user 是通过 Suspense 兼容的 API 获取的
  const user = userResource.read(id); // 如果没准备好，抛出 Promise
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

## useTransition：区分紧急和非紧急更新

```jsx
import { useState, useTransition } from "react";

function SearchResults() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    // 紧急更新：立即显示输入的字符
    setQuery(e.target.value);

    // 非紧急更新：可以被打断的搜索结果更新
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

  // 延迟值：在 UI 响应紧急更新后，再更新这个值
  const deferredText = useDeferredValue(text);

  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      {/* 这个列表用延迟值，不会阻塞 input */}
      <HeavyList query={deferredText} />
    </>
  );
}
```

## 2019 年的状态

Concurrent Mode 在 2019 年还在实验阶段：

- 不稳定的 API（正式版 API 可能会变）
- 只在 `ReactDOM.createRoot` 中启用
- 依赖 Suspense 的数据获取库还不成熟（relay、swr 在跟进）

预计 2020-2021 年才会稳定。现在了解概念，为以后做准备。

## 小结

- Concurrent Mode：渲染可中断，高优先级任务可打断低优先级渲染
- Suspense：统一处理异步加载状态，组件更纯粹
- useTransition：区分紧急和非紧急状态更新
- useDeferredValue：延迟非紧急值更新，类似 debounce 但更聪明
- 2019 年还是实验特性，生产项目谨慎使用
