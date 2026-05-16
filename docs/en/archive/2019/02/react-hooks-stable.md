---
title: "React 16.8 Released: Hooks Are Now Stable"
date: 2019-02-07 16:48:06
tags:
  - React
readingTime: 1
description: "React 16.8 was officially released yesterday, and Hooks have moved from proposal to stable API! This is the most significant React update in years. Let me write"
---

React 16.8 was officially released yesterday, and Hooks have moved from proposal to stable API! This is the most significant React update in years. Let me write a thorough post about it.

## Why We Need Hooks

Three pain points with class components:

1. **Hard-to-reuse stateful logic**: HOC nesting hell ("wrapper hell"), render props that are hard to read
2. **Scattered lifecycle logic**: related logic split across componentDidMount / componentDidUpdate / componentWillUnmount
3. **`this` confusion**: confusing for beginners, requires `bind` or arrow functions

Hooks give function components state and side effects, solving all of the above.

## Basic Hooks

```javascript
import React, { useState, useEffect, useRef } from "react";

function Counter() {
  // useState: state
  const [count, setCount] = useState(0);
  const [name, setName] = useState("Alice");

  // useEffect: side effects (equivalent to lifecycle methods)
  useEffect(() => {
    document.title = `Count: ${count}`;

    // Return a cleanup function (equivalent to componentWillUnmount)
    return () => {
      document.title = "App";
    };
  }, [count]); // dependency array: re-runs only when count changes

  // Second argument []: runs only on mount (componentDidMount)
  useEffect(() => {
    console.log("Component mounted");
    return () => console.log("Component unmounted");
  }, []);

  // useRef: a reference (doesn't trigger re-renders)
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

## Custom Hooks: Logic Reuse

The biggest value of Hooks is **custom Hooks** — any stateful logic can be extracted.

```javascript
// useLocalStorage: state persisted to localStorage
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

// useDebounce: debounced value
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage
function SearchBox() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
```
