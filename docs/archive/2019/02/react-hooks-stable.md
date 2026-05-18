---
title: "React 16.8 发布：Hooks 正式版来了"
date: 2019-02-07 16:48:06
tags:
  - React
readingTime: 2
description: "昨天 React 16.8 正式发布，Hooks 从提案变成正式 API！这是 React 近年来最重要的更新，认真写一篇。"
---

昨天 React 16.8 正式发布，Hooks 从提案变成正式 API！这是 React 近年来最重要的更新，认真写一篇。

## 为什么需要 Hooks

Class 组件的三个痛点：

1. **状态逻辑难以复用**：HOC 嵌套地狱（"包装地狱"），render props 代码难读
2. **生命周期逻辑分散**：相关逻辑拆分在 componentDidMount / componentDidUpdate / componentWillUnmount
3. **this 问题**：初学者困惑，需要 bind 或箭头函数

Hooks 让函数组件有了状态和副作用，解决了以上问题。

## 基础 Hooks

```javascript
import React, { useState, useEffect, useRef } from "react";

function Counter() {
  // useState：状态
  const [count, setCount] = useState(0);
  const [name, setName] = useState("Alice");

  // useEffect：副作用（相当于生命周期）
  useEffect(() => {
    document.title = `计数: ${count}`;

    // 返回清理函数（相当于 componentWillUnmount）
    return () => {
      document.title = "应用";
    };
  }, [count]); // 依赖数组：只有 count 变化时才重新执行

  // 第二参数为 []：只在挂载时执行一次（componentDidMount）
  useEffect(() => {
    console.log("组件挂载");
    return () => console.log("组件卸载");
  }, []);

  // useRef：引用（不触发重渲染）
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

## 自定义 Hook：逻辑复用

Hooks 最大的价值在于**自定义 Hook**——可以提取任何有状态的逻辑。

```javascript
// useLocalStorage：持久化到 localStorage 的状态
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

## Hooks 规则

必须遵守的两条规则（eslint-plugin-react-hooks 帮你检查）：

1. **只在最顶层调用 Hook**：不能在循环、条件、嵌套函数中调用
2. **只在 React 函数中调用 Hook**：函数组件 或 自定义 Hook

```javascript
// ❌ 错误：条件中调用
if (condition) {
  const [state, setState] = useState(0); // 破坏 Hook 顺序
}

// ❌ 错误：普通函数中调用
function normalFunction() {
  const [state] = useState(0); // 不是 React 函数
}
```

## 从 Class 组件迁移

```javascript
// Class 组件
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

// 等价的 Hooks 版本
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

## 团队迁移建议

- **新组件全用 Hooks**，不用再写 Class
- **老组件不强制迁移**，Hooks 和 Class 可以共存
- **装 eslint-plugin-react-hooks** 自动检查 Hooks 规则
- **不要一次性重构**，在修改老组件时顺便迁移

这次 Hooks 正式版发布是个历史节点，函数式编程在 React 生态算是彻底胜利了。
