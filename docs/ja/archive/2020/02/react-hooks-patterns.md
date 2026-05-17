---
title: "実プロジェクトにおけるReact Hooksパターンまとめ"
date: 2020-02-27 15:48:54
tags:
  - React
readingTime: 2
description: "React Hooks 发布一年多了，从最初的不适应到现在的离不开，总结一些项目中高频使用的自定义 Hook 模式。"
---

React Hooks 发布一年多了，从最初的不适应到现在的离不开，总结一些项目中高频使用的自定义 Hook 模式。

## useRequest：統一データフェッチング

```javascript
import { useState, useEffect, useCallback } from 'react';

function useRequest(requestFn, options = {}) {
  const { manual = false, onSuccess, onError, initialData } = options;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestFn(...args);
      setData(result);
      onSuccess?.(result);
      return result;
    } catch (err) {
      setError(err);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [requestFn]);

  useEffect(() => {
    if (!manual) {
      run();
    }
  }, []);

  return { data, loading, error, run };
}

// 使用
function UserList() {
  const { data, loading, run: refetch } = useRequest(
    () => fetch('/api/users').then(r => r.json()),
    { initialData: [] }
  );

  if (loading) return <Spin />;
  return (
    <ul>
      {data.map(user => <li key={user.id}>{user.name}</li>)}
      <button onClick={refetch}>刷新</button>
    </ul>
  );
}
```

## useDebounceとuseThrottle

```javascript
import { useState, useEffect, useRef, useCallback } from 'react';

function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function useThrottle(callback, delay = 300) {
  const lastRun = useRef(Date.now());
  const timer = useRef(null);

  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = now;
    } else {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        callback(...args);
        lastRun.current = Date.now();
      }, delay - (now - lastRun.current));
    }
  }, [callback, delay]);
}

// 使用：搜索防抖
function SearchBox() {
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounce(keyword, 500);

  useEffect(() => {
    if (debouncedKeyword) {
      fetch(`/api/search?q=${debouncedKeyword}`);
    }
  }, [debouncedKeyword]);

  return <input value={keyword} onChange={e => setKeyword(e.target.value)} />;
}
```

## useLocalStorage：持久化状态

```javascript
import { useState, useCallback } from 'react';

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`读取 localStorage[${key}] 失败:`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function
        ? value(storedValue)
        : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`写入 localStorage[${key}] 失败:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

// 使用
function App() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  const [lang, setLang] = useLocalStorage('lang', 'zh-CN');

  return (
    <div className={theme}>
      <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
        切换主题
      </button>
    </div>
  );
}
```

## usePrevious：获取上一次的值

```javascript
import { useRef, useEffect } from 'react';

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// 使用：显示值的变化
function Counter() {
  const [count, setCount] = useState(0);
  const prevCount = usePrevious(count);

  return (
    <div>
      <p>现在: {count}, 上一次: {prevCount}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

## Hooks 使用注意事项

```javascript
// 1. 闭包陷阱：useRef 获取最新值
function Counter() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  countRef.current = count;

  useEffect(() => {
    const timer = setInterval(() => {
      // 用 countRef.current 而不是 count
      console.log('当前值:', countRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 空依赖，只创建一次

  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// 2. 减少不必要的重渲染：useMemo + useCallback
const ExpensiveList = React.memo(({ items, onItemClick }) => (
  <ul>
    {items.map(item => (
      <li key={item.id} onClick={() => onItemClick(item.id)}>
        {item.name}
      </li>
    ))}
  </ul>
));

function Parent() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');

  const filteredItems = useMemo(
    () => items.filter(i => i.name.includes(filter)),
    [items, filter]
  );

  const handleClick = useCallback((id) => {
    console.log('clicked:', id);
  }, []);

  return <ExpensiveList items={filteredItems} onItemClick={handleClick} />;
}
```

## まとめ

- 自定义 Hook 是复用逻辑的核心手段，比 HOC 和 render props 更直观
- `useRef` 解决闭包陷阱，存储不需要触发渲染的值
- `useMemo` 和 `useCallback` 配合 `React.memo` 减少不必要的重渲染
- 实际项目中，数据请求、防抖节流、本地存储是最高频的三个 Hook 场景
