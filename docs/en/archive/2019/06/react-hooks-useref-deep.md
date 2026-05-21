---
title: "useRef Is More Than Just Getting DOM References"
date: 2019-06-03 17:18:18
tags:
  - React
readingTime: 1
description: "`useRef` is one of those Hooks that many developers know by name but only partially understand. Beyond the common use of \"getting a DOM reference,\" it has anoth"
wordCount: 167
---

`useRef` is one of those Hooks that many developers know by name but only partially understand. Beyond the common use of "getting a DOM reference," it has another crucial role: acting as an instance variable that persists across renders without causing re-renders.

## Basic Use: DOM Reference

```jsx
import React, { useRef, useEffect } from "react";

function AutoFocusInput() {
  const inputRef = useRef(null);

  useEffect(() => {
    // Access the DOM node after mount
    inputRef.current.focus();
  }, []);

  return <input ref={inputRef} placeholder="Auto-focused on mount" />;
}
```

## The Key: Persisting Values Without Triggering Re-renders

The key difference between `useRef` and `useState`:

- `useState`: updating state triggers a re-render
- `useRef`: updating `ref.current` does **not** trigger a re-render

This makes `useRef` perfect for storing values that need to persist between renders but shouldn't cause re-renders when they change.

## Practical Example: Stopwatch

```jsx
function Stopwatch() {
  const [time, setTime] = useState(0); // display — triggers re-render
  const intervalRef = useRef(null); // timer ID — no re-render needed
  const startTimeRef = useRef(null); // start timestamp — no re-render needed

  function start() {
    if (intervalRef.current !== null) return; // already running
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
      <p>{time}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

Why store `intervalRef` in a ref instead of state? Because we need to access the timer ID in `stop()` to clear it — but updating the timer ID should never cause a re-render of the component.

## Storing the Previous Value

```jsx
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current; // returns the previous render's value
}

function Counter() {
  const [count, setCount] = useState(0);
  const prevCount = usePrevious(count);

  return (
    <div>
      <p>
        Current: {count}, Previous: {prevCount}
      </p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}
```

Mental model for `useRef`: it's a mutable container that persists for the lifetime of the component. Use it for anything that needs to "remember" a value without triggering a re-render.
