---
title: "useRefはDOMの取得だけじゃない"
date: 2019-06-03 17:18:18
tags:
  - React
readingTime: 2
description: "`useRef`は名前は知っていても理解が不完全な開発者が多いHookの一つです。「DOMの参照を取得する」という一般的な使い方以外に、もう一つの重要な役割があります：再レンダリングを引き起こさずにレンダリング間で持続するインスタンス変数として機能することです。"
wordCount: 439
---

`useRef`は名前は知っていても理解が不完全な開発者が多いHookの一つです。「DOMの参照を取得する」という一般的な使い方以外に、もう一つの重要な役割があります：再レンダリングを引き起こさずにレンダリング間で持続するインスタンス変数として機能することです。

## 基本的な使い方：DOMの参照

```jsx
import React, { useRef, useEffect } from "react";

function AutoFocusInput() {
  const inputRef = useRef(null);

  useEffect(() => {
    // マウント後にDOMノードにアクセス
    inputRef.current.focus();
  }, []);

  return <input ref={inputRef} placeholder="マウント時に自動フォーカス" />;
}
```

## 重要なポイント：再レンダリングを引き起こさずに値を保持

`useRef`と`useState`の主な違い：

- `useState`: ステートを更新すると再レンダリングがトリガーされる
- `useRef`: `ref.current`を更新しても再レンダリングは**発生しない**

これにより`useRef`はレンダリング間で持続する必要があるが、変更時に再レンダリングを引き起こすべきでない値の保存に最適です。

## 実践例：ストップウォッチ

```jsx
function Stopwatch() {
  const [time, setTime] = useState(0); // 表示 — 再レンダリングをトリガー
  const intervalRef = useRef(null); // タイマーID — 再レンダリング不要
  const startTimeRef = useRef(null); // 開始タイムスタンプ — 再レンダリング不要

  function start() {
    if (intervalRef.current !== null) return; // 既に動いている
    startTimeRef.current = Date.now() - time * 1000;
    intervalRef.current = setInterval(() => {
      setTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 100);
  }

  function stop() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  function reset() {
    stop();
    setTime(0);
    startTimeRef.current = null;
  }

  return (
    <div>
      <p>{time}秒</p>
      <button onClick={start}>開始</button>
      <button onClick={stop}>停止</button>
      <button onClick={reset}>リセット</button>
    </div>
  );
}
```

なぜ`intervalRef`をstateではなくrefに保存するのか？`stop()`でタイマーIDをクリアするためにアクセスする必要があるが、タイマーIDの更新でコンポーネントの再レンダリングを引き起こすべきではないからです。

## 前の値を保存する

```jsx
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current; // 前のレンダリングの値を返す
}

function Counter() {
  const [count, setCount] = useState(0);
  const prevCount = usePrevious(count);

  return (
    <div>
      <p>
        現在: {count}、前回: {prevCount}
      </p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}
```

`useRef`のメンタルモデル：コンポーネントのライフタイム全体で持続する変更可能なコンテナです。再レンダリングを引き起こさずに値を「覚えておく」必要があるものすべてに使いましょう。
