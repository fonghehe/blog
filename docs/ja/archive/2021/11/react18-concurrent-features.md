---
title: "React 18 新機能プレビュー：並行機能が正式に登場"
date: 2021-11-20 17:22:18
tags:
  - React
  - JavaScript

readingTime: 2
description: "React 18 Alpha がリリースされ、試用できるようになりました。2年間待ち望んだ Concurrent 機能がついに正式版となります。"
wordCount: 341
---

React 18 Alpha がリリースされ、試用できるようになりました。2年間待ち望んだ Concurrent 機能がついに正式版となります。

## 並行レンダリング

React 18 の核心的な変更点：レンダリングが中断・再開可能なプロセスになります。

```javascript
// React 17：同期レンダリング
import ReactDOM from "react-dom";
ReactDOM.render(<App />, document.getElementById("root"));

// React 18：並行レンダリング
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(<App />);
```

この1行の変更だけで、多くの並行機能が有効になります。

## Automatic Batching（自動バッチ処理）

```javascript
// React 17：React のイベントハンドラ内でのみバッチ処理
function handleClick() {
  setCount((c) => c + 1); // 個別にレンダリング
  setName("Alice"); // 個別にレンダリング
  // 2回の setState → 2回のレンダリング
}

// Promise/setTimeout 内ではバッチ処理されない
setTimeout(() => {
  setCount((c) => c + 1); // 1回レンダリング
  setName("Alice"); // 1回レンダリング
  // 2回の setState → 2回のレンダリング！
});

// React 18：すべての場所で自動バッチ処理
setTimeout(() => {
  setCount((c) => c + 1);
  setName("Alice");
  // 1回だけレンダリング！
});
```

コードの変更は一切不要で、パフォーマンスが自動的に向上します。

## useTransition

```javascript
import { useState, useTransition } from "react";

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e) {
    // 緊急更新：入力欄が即座に応答
    setQuery(e.target.value);

    // 非緊急（中断可能な）更新
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

ユーザーの入力は常にスムーズで、検索結果の更新が入力をブロックすることはありません。

## useDeferredValue

```javascript
import { useState, useDeferredValue } from "react";

function App() {
  const [text, setText] = useState("");
  const deferredText = useDeferredValue(text);

  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      {/* 遅延値を使用し、input の応答をブロックしません */}
      <HeavyList text={deferredText} />
    </>
  );
}
```

## Suspense の改善

```javascript
// React 18：Suspense がサーバーサイドレンダリング（SSR）をサポート
// ページをセグメントごとにストリーミングレンダリングでき、すべてのデータが準備できるのを待つ必要はありません

function ProfilePage() {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>

      <Suspense fallback={<PostsSkeleton />}>
        <Posts /> {/* 独立してロード可能、Header を待つ必要はありません */}
      </Suspense>

      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </div>
  );
}
// ストリーミング SSR：最初に HTML スケルトンを送信し、データの準備ができ次第ストリーミングで埋め込む
```

## useId

```javascript
import { useId } from 'react'

// 一意の ID を生成（サーバーとクライアントで一致し、SSR hydration の不一致問題を解決）
function FormField({ label, type }) {
  const id = useId()

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} />
    </div>
  )
}

// ✅ 同じコンポーネントを複数回使用しても、ID は衝突しない
<FormField label="名前" type="text" />    // id: :r0:
<FormField label="メール" type="email" />   // id: :r1:
```

## アップグレード時の注意点

```javascript
// createRoot で ReactDOM.render を置き換え（必須）
// ただし React 18 でも ReactDOM.render は引き続き使用可能（互換モード、並行機能は有効にならない）

// useEffect の副作用を使用している場合、React 18 の StrictMode では2回実行される
// 不純な副作用を検出するため（開発モード）
// 本番モードでは影響なし
```

## まとめ

- Automatic Batching は React 18 の最も実用的な改善で、コードの変更は不要です
- useTransition：緊急/非緊急の更新を区別し、UI の応答性を維持します
- Suspense SSR：ストリーミングレンダリングにより、ユーザーはより早くコンテンツを表示できます
- useId：SSR と CSR で一貫した一意の ID を提供します
- 正式版は2022年初頭にリリース予定です
