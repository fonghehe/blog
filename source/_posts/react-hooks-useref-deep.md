---
title: "useRef 不只是获取 DOM 那么简单"
date: 2019-06-03 17:18:18
tags:
  - React
---

很多人一提到 `useRef`，第一反应就是「用来获取 DOM 节点」。但 `useRef` 的能力远不止于此。它本质上是在函数组件中提供了一个跨渲染周期持久存在的可变容器，这个特性让它在很多场景下成为不可替代的工具。

## useRef 基础：获取 DOM 引用

先回顾最基础的用法——获取 DOM 节点：

```javascript
import React, { useRef, useEffect } from 'react';

function TextInputWithFocus() {
  // 创建 ref，初始值为 null
  const inputRef = useRef(null);

  useEffect(() => {
    // 组件挂载后，inputRef.current 指向真实的 input DOM 节点
    inputRef.current.focus();
    inputRef.current.setSelectionRange(0, 0);
  }, []);

  const handleClick = () => {
    // 点击按钮时也能操作 DOM
    inputRef.current.value = '';
    inputRef.current.focus();
  };

  return (
    <div>
      <input ref={inputRef} type="text" defaultValue="Hello World" />
      <button onClick={handleClick}>清空并聚焦</button>
    </div>
  );
}
```

关键点：`useRef` 返回一个带有 `current` 属性的可变对象，将它传给 JSX 的 `ref` 属性后，React 会在 DOM 渲染完成后把真实节点赋值给 `current`。

## useRef 作为实例变量

这是 `useRef` 最容易被忽视、但最有价值的用途之一。在 class 组件中我们有 `this.xxx` 来存储不触发重新渲染的变量，函数组件中 `useRef` 就是等价方案。

```javascript
import React, { useState, useRef, useCallback } from 'react';

function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  // 用 ref 存储 interval ID，不会因为赋值而触发重新渲染
  const intervalRef = useRef(null);

  // 用 ref 存储开始时间戳
  const startTimeRef = useRef(null);

  const start = useCallback(() => {
    if (running) return;

    setRunning(true);
    startTimeRef.current = Date.now() - elapsed;

    // 存储 interval ID 到 ref 中
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 100);
  }, [running, elapsed]);

  const stop = useCallback(() => {
    setRunning(false);
    // 使用 ref 中存储的 ID 来清除定时器
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
      <p>耗时: {(elapsed / 1000).toFixed(1)}s</p>
      <button onClick={start} disabled={running}>开始</button>
      <button onClick={stop} disabled={!running}>暂停</button>
      <button onClick={reset}>重置</button>
    </div>
  );
}
```

如果把 `intervalRef` 换成 `useState`，每次 `setIntervalId` 都会触发一次无意义的重新渲染，而且在 `setInterval` 的回调闭包中拿到的 state 可能是旧值——这正是 ref 的用武之地。

## 存储上一次的值

`useRef` 的 `current` 值在每次渲染之间持久存在，这个特性天然适合存储「上一次渲染时的值」：

```javascript
import React, { useState, useEffect, useRef } from 'react';

// 自定义 Hook：获取上一次的值
function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    // 每次渲染完成后，把当前值存入 ref
    // 注意：这个 effect 在 render 之后执行
    ref.current = value;
  });

  // 返回的是上一次渲染时存入 ref 的值
  return ref.current;
}

function ProfileChangeTracker({ userId }) {
  const [user, setUser] = useState(null);
  const previousUserId = usePrevious(userId);

  useEffect(() => {
    console.log(`userId 从 ${previousUserId} 变为 ${userId}`);
    // 实际项目中这里会发请求
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => setUser(data));
  }, [userId]);

  return (
    <div>
      {previousUserId && <p>上一个用户ID: {previousUserId}</p>}
      {user && <p>当前用户: {user.name}</p>}
    </div>
  );
}
```

为什么不用 state 存上一次的值？因为 state 变化会触发重新渲染，而我们只是想「记录」一下，并不需要因为记录本身触发渲染。这就是 ref 和 state 的本质区别。

## ref 与 state 的区别和选择

很多初学者分不清什么时候用 ref、什么时候用 state。核心原则很简单：

```javascript
import React, { useState, useRef, useEffect } from 'react';

function RefVsStateDemo() {
  // state：需要反映到 UI 上的值 → 用 useState
  const [count, setCount] = useState(0);

  // ref：不需要展示在 UI 上，但需要在渲染间保持的值 → 用 useRef
  const renderCountRef = useRef(0);
  const prevCountRef = useRef();

  useEffect(() => {
    // 每次渲染时 ref 加 1，但这不会触发额外的渲染
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
      <p>当前组件已渲染 {renderCountRef.current + 1} 次</p>
    </div>
  );
}
```

判断标准：
- 这个值变化后需要触发 UI 更新吗？**需要 → useState，不需要 → useRef**
- 这个值是用来「计算」还是「记录」？**计算 → useState，记录 → useRef**

## forwardRef 与 useImperativeHandle

当父组件需要操作子组件内部的 DOM 时，普通的 `ref` 无法直接传递，需要 `React.forwardRef`：

```javascript
import React, { useRef, forwardRef, useImperativeHandle } from 'react';

// 子组件：用 forwardRef 包裹，第二个参数接收 ref
const FancyInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);

  // useImperativeHandle：自定义暴露给父组件的实例值
  // 不暴露整个 DOM 节点，只暴露我们想让外部调用的方法
  useImperativeHandle(ref, () => ({
    // 自定义 focus 方法：聚焦并选中文字
    focusAndSelect: () => {
      inputRef.current.focus();
      inputRef.current.select();
    },
    // 获取当前值
    getValue: () => {
      return inputRef.current.value;
    },
    // 清空并聚焦
    clearAndFocus: () => {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }));

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="请输入..."
      onChange={props.onChange}
    />
  );
});

// 父组件
function Form() {
  const fancyInputRef = useRef(null);

  const handleFocusAndSelect = () => {
    // 调用子组件暴露的方法
    fancyInputRef.current.focusAndSelect();
  };

  const handleGetValue = () => {
    const value = fancyInputRef.current.getValue();
    alert(`当前值: ${value}`);
  };

  return (
    <div>
      <FancyInput ref={fancyInputRef} onChange={() => {&#125;&#125; />
      <button onClick={handleFocusAndSelect}>聚焦并选中</button>
      <button onClick={handleGetValue}>获取值</button>
    </div>
  );
}
```

`useImperativeHandle` 的核心价值是**控制暴露的接口**。如果不使用它，父组件通过 ref 拿到的是整个 DOM 节点，父组件可以随意操作——比如 `fancyInputRef.current.style.display = 'none'`。这种直接操作破坏了组件的封装性。通过 `useImperativeHandle` 我们只暴露有限的、安全的方法。

## 在 setInterval 中正确使用 ref

这是实际开发中非常常见的坑。看这个计数器组件：

```javascript
import React, { useState, useRef, useEffect } from 'react';

function IntervalCounter() {
  // ❌ 错误写法：在 setInterval 闭包中直接读取 state
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      // 这里的 count 永远是 0（useEffect 闭包捕获了初始值）
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // 空依赖，effect 只执行一次

  // ✅ 正确写法一：用函数式更新
  // setCount(prev => prev + 1) 不依赖外部的 count

  // ✅ 正确写法二：用 ref 存储最新值
  const [count2, setCount2] = useState(0);
  const count2Ref = useRef(count2);
  count2Ref.current = count2; // 每次渲染都同步最新值

  useEffect(() => {
    const id = setInterval(() => {
      // 闭包中的 count2Ref.current 始终是最新的
      setCount2(count2Ref.current + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // 不需要把 count2 放进依赖

  return (
    <div>
      <p>错误写法的 count: {count}（可能永远是 1）</p>
      <p>正确写法的 count2: {count2}</p>
    </div>
  );
}
```

函数式更新和 ref 更新是解决闭包捕获旧值的两种思路。函数式更新更简洁，但有些场景（比如需要把值传给非 React 的 API）就必须用 ref。

## 实际项目中的综合运用

最后看一个真实场景：防抖搜索组件，综合运用了 ref 的多种能力：

```javascript
import React, { useState, useRef, useEffect, useCallback } from 'react';

function DebouncedSearch({ onSearch }) {
  const [keyword, setKeyword] = useState('');

  // 存储防抖定时器 ID
  const timerRef = useRef(null);
  // 存储上一次搜索的关键词，避免重复搜索
  const lastSearchRef = useRef('');
  // 标记组件是否已卸载，避免卸载后的状态更新
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // 组件卸载时清除可能存在的定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setKeyword(value);

    // 清除上一次的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // 设置新的防抖定时器
    timerRef.current = setTimeout(() => {
      // 防止卸载后执行
      if (!mountedRef.current) return;
      // 避免重复搜索相同关键词
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
        placeholder="搜索..."
      />
    </div>
  );
}
```

## 小结

- `useRef` 的本质是提供一个在组件整个生命周期内持久存在的可变容器，`.current` 的修改不会触发重新渲染
- 不只是获取 DOM——存储定时器 ID、上一次的值、防抖/节流标记、订阅句柄等都是常见用途
- 选择 ref 还是 state 的核心标准：这个值的变化是否需要反映到 UI 上
- `forwardRef` + `useImperativeHandle` 可以精确控制子组件暴露给父组件的接口
- 在异步回调（`setInterval`、`setTimeout`、事件监听）中，ref 是拿到最新值的可靠手段
