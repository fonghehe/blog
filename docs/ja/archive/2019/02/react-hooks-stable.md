---
title: "React 16.8リリース：Hooksが正式版になった"
date: 2019-02-07 16:48:06
tags:
  - React
readingTime: 2
description: "昨日React 16.8が正式リリースされ、HooksがプロポーザルからStable APIになった！これはReact近年最も重要なアップデートだ。しっかりと記事を書こうと思う。"
---

昨日React 16.8が正式リリースされ、HooksがプロポーザルからStable APIになった！これはReact近年最も重要なアップデートだ。しっかりと記事を書こうと思う。

## なぜHooksが必要なのか

クラスコンポーネントの3つの痛点：

1. **ステートロジックの再利用が難しい**：HOCのネスト地獄（「ラッパー地獄」）、読みにくいrender props
2. **ライフサイクルロジックが分散**：関連するロジックがcomponentDidMount / componentDidUpdate / componentWillUnmountに散らばっている
3. **`this`の問題**：初学者を混乱させ、`bind`やアロー関数が必要

Hooksにより関数コンポーネントにもstateとサイドエフェクトを持たせることができ、上記の問題を解決する。

## 基本フック

```javascript
import React, { useState, useEffect, useRef } from "react";

function Counter() {
  // useState：状態
  const [count, setCount] = useState(0);
  const [name, setName] = useState("Alice");

  // useEffect：サイドエフェクト（ライフサイクルに相当）
  useEffect(() => {
    document.title = `カウント: ${count}`;

    // クリーンアップ関数を返す（componentWillUnmountに相当）
    return () => {
      document.title = "アプリ";
    };
  }, [count]); // 依存配列：countが変化した時のみ再実行

  // 第2引数が[]：マウント時のみ一度実行（componentDidMount）
  useEffect(() => {
    console.log("コンポーネントマウント");
    return () => console.log("コンポーネントアンマウント");
  }, []);

  // useRef：参照（再レンダリングをトリガーしない）
  const inputRef = useRef(null);

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
      <input ref={inputRef} />
    </div>
  );
}
```

## カスタムフック：ロジックの再利用

Hooksの最大の価値は**カスタムフック**だ——ステートを持つロジックを何でも抽出できる。

```javascript
// useLocalStorage：localStorageに永続化される状態
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue = (value) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setValue(valueToStore);
    localStorage.setItem(key, JSON.stringify(valueToStore));
  };

  return [value, setStoredValue];
}

// useDebounce：デバウンスされた値
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 使い方
function SearchBox() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
```
