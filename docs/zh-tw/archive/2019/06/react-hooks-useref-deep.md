---
title: "useRef 不只是獲取 DOM 那麼簡單"
date: 2019-06-03 17:18:18
tags:
  - React
readingTime: 5
description: "很多人一提到 `useRef`，第一反應就是「用來獲取 DOM 節點」。但 `useRef` 的能力遠不止於此。它本質上是在函式元件中提供了一個跨渲染週期持久存在的可變容器，這個特性讓它在很多場景下成為不可替代的工具。"
---

很多人一提到 `useRef`，第一反應就是「用來獲取 DOM 節點」。但 `useRef` 的能力遠不止於此。它本質上是在函式元件中提供了一個跨渲染週期持久存在的可變容器，這個特性讓它在很多場景下成為不可替代的工具。

## useRef 基礎：獲取 DOM 引用

先回顧最基礎的用法——獲取 DOM 節點：

```javascript
import React, { useRef, useEffect } from 'react';

function TextInputWithFocus() {
  // 建立 ref，初始值為 null
  const inputRef = useRef(null);

  useEffect(() => {
    // 元件掛載後，inputRef.current 指向真實的 input DOM 節點
    inputRef.current.focus();
    inputRef.current.setSelectionRange(0, 0);
  }, []);

  const handleClick = () => {
    // 點選按鈕時也能操作 DOM
    inputRef.current.value = '';
    inputRef.current.focus();
  };

  return (
    <div>
      <input ref={inputRef} type="text" defaultValue="Hello World" />
      <button onClick={handleClick}>清空並聚焦</button>
    </div>
  );
}
```

關鍵點：`useRef` 返回一個帶有 `current` 屬性的可變物件，將它傳給 JSX 的 `ref` 屬性後，React 會在 DOM 渲染完成後把真實節點賦值給 `current`。

## useRef 作為例項變數

這是 `useRef` 最容易被忽視、但最有價值的用途之一。在 class 元件中我們有 `this.xxx` 來儲存不觸發重新渲染的變數，函式元件中 `useRef` 就是等價方案。

```javascript
import React, { useState, useRef, useCallback } from 'react';

function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  // 用 ref 儲存 interval ID，不會因為賦值而觸發重新渲染
  const intervalRef = useRef(null);

  // 用 ref 儲存開始時間戳
  const startTimeRef = useRef(null);

  const start = useCallback(() => {
    if (running) return;

    setRunning(true);
    startTimeRef.current = Date.now() - elapsed;

    // 儲存 interval ID 到 ref 中
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
  }, [running, elapsed]);

  const stop = useCallback(() => {
    setRunning(false);
    // 使用 ref 中儲存的 ID 來清除定時器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(0);
  }, [stop]);

  return (
    <div>
      <p>耗時: {(elapsed / 1000).toFixed(1)}s</p>
      <button onClick={start} disabled={running}>開始</button>
      <button onClick={stop} disabled={!running}>暫停</button>
      <button onClick={reset}>重置</button>
    </div>
  );
}
```

如果把 `intervalRef` 換成 `useState`，每次 `setIntervalId` 都會觸發一次無意義的重新渲染，而且在 `setInterval` 的回撥閉包中拿到的 state 可能是舊值——這正是 ref 的用武之地。

## 儲存上一次的值

`useRef` 的 `current` 值在每次渲染之間持久存在，這個特性天然適合儲存「上一次渲染時的值」：

```javascript
import React, { useState, useEffect, useRef } from 'react';

// 自定義 Hook：獲取上一次的值
function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    // 每次渲染完成後，把當前值存入 ref
    // 注意：這個 effect 在 render 之後執行
    ref.current = value;
  });

  // 返回的是上一次渲染時存入 ref 的值
  return ref.current;
}

function ProfileChangeTracker({ userId }) {
  const [user, setUser] = useState(null);
  const previousUserId = usePrevious(userId);

  useEffect(() => {
    console.log(`userId 從 ${previousUserId} 變為 ${userId}`);
    // 實際專案中這裡會發請求
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]);

  return (
    <div>
      {previousUserId && <p>上一個使用者ID: {previousUserId}</p>}
      {user && <p>當前使用者: {user.name}</p>}
    </div>
  );
}
```

為什麼不用 state 存上一次的值？因為 state 變化會觸發重新渲染，而我們只是想「記錄」一下，並不需要因為記錄本身觸發渲染。這就是 ref 和 state 的本質區別。

## ref 與 state 的區別和選擇

很多初學者分不清什麼時候用 ref、什麼時候用 state。核心原則很簡單：

```javascript
import React, { useState, useRef, useEffect } from 'react';

function RefVsStateDemo() {
  // state：需要反映到 UI 上的值 → 用 useState
  const [count, setCount] = useState(0);

  // ref：不需要展示在 UI 上，但需要在渲染間保持的值 → 用 useRef
  const renderCountRef = useRef(0);
  const prevCountRef = useRef();

  useEffect(() => {
    // 每次渲染時 ref 加 1，但這不會觸發額外的渲染
    renderCountRef.current += 1;
  });

  useEffect(() => {
    prevCountRef.current = count;
  }, [count]);

  return (
    <div>
      <p>count: {count}</p>
      <p>上一次 count: {prevCountRef.current}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <hr />
      <p>當前元件已渲染 {renderCountRef.current + 1} 次</p>
    </div>
  );
}
```

判斷標準：
- 這個值變化後需要觸發 UI 更新嗎？**需要 → useState，不需要 → useRef**
- 這個值是用來「計算」還是「記錄」？**計算 → useState，記錄 → useRef**

## forwardRef 與 useImperativeHandle

當父元件需要操作子元件內部的 DOM 時，普通的 `ref` 無法直接傳遞，需要 `React.forwardRef`：

```javascript
import React, { useRef, forwardRef, useImperativeHandle } from 'react';

// 子元件：用 forwardRef 包裹，第二個引數接收 ref
const FancyInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);

  // useImperativeHandle：自定義暴露給父元件的例項值
  // 不暴露整個 DOM 節點，只暴露我們想讓外部呼叫的方法
  useImperativeHandle(ref, () => ({
    // 自定義 focus 方法：聚焦並選中文字
    focusAndSelect: () => {
      inputRef.current.focus();
      inputRef.current.select();
    },
    // 獲取當前值
    getValue: () => {
      return inputRef.current.value;
    },
    // 清空並聚焦
    clearAndFocus: () => {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }));

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="請輸入..."
      onChange={props.onChange}
    />
  );
});

// 父元件
function Form() {
  const fancyInputRef = useRef(null);

  const handleFocusAndSelect = () => {
    // 呼叫子元件暴露的方法
    fancyInputRef.current.focusAndSelect();
  };

  const handleGetValue = () => {
    const value = fancyInputRef.current.getValue();
    alert(`當前值: ${value}`);
  };

  return (
    <div>
      <FancyInput ref={fancyInputRef} onChange={() => {&#125;&#125; />
      <button onClick={handleFocusAndSelect}>聚焦並選中</button>
      <button onClick={handleGetValue}>獲取值</button>
    </div>
  );
}
```

`useImperativeHandle` 的核心價值是**控制暴露的介面**。如果不使用它，父元件通過 ref 拿到的是整個 DOM 節點，父元件可以隨意操作——比如 `fancyInputRef.current.style.display = 'none'`。這種直接操作破壞了元件的封裝性。通過 `useImperativeHandle` 我們只暴露有限的、安全的方法。

## 在 setInterval 中正確使用 ref

這是實際開發中非常常見的坑。看這個計數器元件：

```javascript
import React, { useState, useRef, useEffect } from 'react';

function IntervalCounter() {
  // ❌ 錯誤寫法：在 setInterval 閉包中直接讀取 state
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      // 這裡的 count 永遠是 0（useEffect 閉包捕獲了初始值）
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // 空依賴，effect 只執行一次

  // ✅ 正確寫法一：用函式式更新
  // setCount(prev => prev + 1) 不依賴外部的 count

  // ✅ 正確寫法二：用 ref 儲存最新值
  const [count2, setCount2] = useState(0);
  const count2Ref = useRef(count2);
  count2Ref.current = count2; // 每次渲染都同步最新值

  useEffect(() => {
    const id = setInterval(() => {
      // 閉包中的 count2Ref.current 始終是最新的
      setCount2(count2Ref.current + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // 不需要把 count2 放進依賴

  return (
    <div>
      <p>錯誤寫法的 count: {count}（可能永遠是 1）</p>
      <p>正確寫法的 count2: {count2}</p>
    </div>
  );
}
```

函式式更新和 ref 更新是解決閉包捕獲舊值的兩種思路。函式式更新更簡潔，但有些場景（比如需要把值傳給非 React 的 API）就必須用 ref。

## 實際專案中的綜合運用

最後看一個真實場景：防抖搜尋元件，綜合運用了 ref 的多種能力：

```javascript
import React, { useState, useRef, useEffect, useCallback } from 'react';

function DebouncedSearch({ onSearch }) {
  const [keyword, setKeyword] = useState('');

  // 儲存防抖定時器 ID
  const timerRef = useRef(null);
  // 儲存上一次搜尋的關鍵詞，避免重複搜尋
  const lastSearchRef = useRef('');
  // 標記元件是否已解除安裝，避免解除安裝後的狀態更新
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 元件解除安裝時清除可能存在的定時器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setKeyword(value);

    // 清除上一次的定時器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // 設定新的防抖定時器
    timerRef.current = setTimeout(() => {
      // 防止解除安裝後執行
      if (!mountedRef.current) return;
      // 避免重複搜尋相同關鍵詞
      if (value === lastSearchRef.current) return;

      lastSearchRef.current = value;
      onSearch(value);
    }, 300);
  }, [onSearch]);

  return (
    <div>
      <input
        type="text"
        value={keyword}
        onChange={handleChange}
        placeholder="搜尋..."
      />
    </div>
  );
}
```

## 小結

- `useRef` 的本質是提供一個在元件整個生命週期內持久存在的可變容器，`.current` 的修改不會觸發重新渲染
- 不只是獲取 DOM——儲存定時器 ID、上一次的值、防抖/節流標記、訂閱控制代碼等都是常見用途
- 選擇 ref 還是 state 的核心標準：這個值的變化是否需要反映到 UI 上
- `forwardRef` + `useImperativeHandle` 可以精確控制子元件暴露給父元件的介面
- 在非同步回撥（`setInterval`、`setTimeout`、事件監聽）中，ref 是拿到最新值的可靠手段
