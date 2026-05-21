---
title: "React 16.8 釋出：Hooks 正式版來了"
date: 2019-02-07 16:48:06
tags:
  - React
readingTime: 2
description: "昨天 React 16.8 正式釋出，Hooks 從提案變成正式 API！這是 React 近年來最重要的更新，認真寫一篇。"
wordCount: 333
---

昨天 React 16.8 正式釋出，Hooks 從提案變成正式 API！這是 React 近年來最重要的更新，認真寫一篇。

## 為什麼需要 Hooks

Class 元件的三個痛點：

1. **狀態邏輯難以複用**：HOC 巢狀地獄（"包裝地獄"），render props 程式碼難讀
2. **生命週期邏輯分散**：相關邏輯拆分在 componentDidMount / componentDidUpdate / componentWillUnmount
3. **this 問題**：初學者困惑，需要 bind 或箭頭函式

Hooks 讓函式元件有了狀態和副作用，解決了以上問題。

## 基礎 Hooks

```javascript
import React, { useState, useEffect, useRef } from "react";

function Counter() {
  // useState：狀態
  const [count, setCount] = useState(0);
  const [name, setName] = useState("Alice");

  // useEffect：副作用（相當於生命週期）
  useEffect(() => {
    document.title = `計數: ${count}`;

    // 返回清理函式（相當於 componentWillUnmount）
    return () => {
      document.title = "應用";
    };
  }, [count]); // 依賴陣列：只有 count 變化時才重新執行

  // 第二引數為 []：只在掛載時執行一次（componentDidMount）
  useEffect(() => {
    console.log("元件掛載");
    return () => console.log("元件解除安裝");
  }, []);

  // useRef：引用（不觸發重渲染）
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

## 自定義 Hook：邏輯複用

Hooks 最大的價值在於**自定義 Hook**——可以提取任何有狀態的邏輯。

```javascript
// useLocalStorage：持久化到 localStorage 的狀態
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

// useDebounce：防抖值
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 使用
function SearchBox() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      fetch(`/api/search?q=${debouncedQuery}`);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

## Hooks 規則

必須遵守的兩條規則（eslint-plugin-react-hooks 幫你檢查）：

1. **只在最頂層呼叫 Hook**：不能在迴圈、條件、巢狀函式中呼叫
2. **只在 React 函式中呼叫 Hook**：函式元件 或 自定義 Hook

```javascript
// ❌ 錯誤：條件中呼叫
if (condition) {
  const [state, setState] = useState(0); // 破壞 Hook 順序
}

// ❌ 錯誤：普通函式中呼叫
function normalFunction() {
  const [state] = useState(0); // 不是 React 函式
}
```

## 從 Class 元件遷移

```javascript
// Class 元件
class Timer extends React.Component {
  state = { seconds: 0 };

  componentDidMount() {
    this.interval = setInterval(() => {
      this.setState((s) => ({ seconds: s.seconds + 1 }));
    }, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    return <div>{this.state.seconds}s</div>;
  }
}

// 等價的 Hooks 版本
function Timer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval); // 清理
  }, []);

  return <div>{seconds}s</div>;
}
```

## 團隊遷移建議

- **新元件全用 Hooks**，不用再寫 Class
- **老元件不強制遷移**，Hooks 和 Class 可以共存
- **裝 eslint-plugin-react-hooks** 自動檢查 Hooks 規則
- **不要一次性重構**，在修改老元件時順便遷移

這次 Hooks 正式版釋出是個歷史節點，函數語言程式設計在 React 生態算是徹底勝利了。
