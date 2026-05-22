---
title: "React Concurrent Mode 初探：时间切片与 Suspense 实验"
date: 2019-05-27 16:57:55
tags:
  - React
readingTime: 1
description: "ReactチームはReact Conf 2019でConcurrent Modeの詳細を公開しました。React 16.8 Hooks以降で最も重要な機能ですが、安定版リリースは2020年になる可能性があります。"
wordCount: 233
---

ReactチームはReact Conf 2019でConcurrent Modeの詳細を公開しました。React 16.8 Hooks以降で最も重要な機能ですが、安定版リリースは2020年になる可能性があります。

## Concurrent Modeが解決する問題

同期レンダリングの問題：Reactがレンダリングを開始すると中断できません。大きなコンポーネントツリーのレンダリング中はメインスレッドがブロックされ、ユーザー操作に反応できなくなります。

```javascript
// 従来の同期レンダリング
// レンダリング開始 → レンダリング完了（その間ユーザー操作に無反応）
ReactDOM.render(<App />, document.getElementById("root"));

// Concurrent Mode：レンダリングを中断できる
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
// レンダリング中にユーザー入力に反応でき、高優先度タスクが低優先度レンダリングを中断できる
```

## Suspense：データ取得の非同期化

```jsx
// 以前のローディングパターン（各コンポーネントが独自のloading状態を管理）
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

// Suspenseパターン（コンポーネントはデータのみ気にし、ローディングは親レベルで一元管理）
function UserProfile({ id }) {
  const user = userResource.read(id); // 準備できていない場合はPromiseをthrow
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

## useTransition：緊急更新と非緊急更新の区別

```jsx
import { useState, useTransition } from "react";

function SearchResults() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    // 緊急更新：入力文字を即座に表示
    setQuery(e.target.value);

    // 非緊急更新：中断可能な検索結果の更新
    startTransition(() => {
      const searchResults = performExpensiveSearch(e.target.value);
      setResults(searchResults);
    });
  }

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending ? <span>検索中...</span> : null}
      <ul>
        {results.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

Concurrent ModeはReactがレンダリングについて考える方法の根本的な転換を表しています——レンダリングの完全性よりもユーザーの応答性を優先します。
