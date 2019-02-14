---
title: "useReducer + useContext 实现轻量状态管理"
date: 2019-02-14 15:47:39
tags:
  - 前端
---

有了 Hooks，小项目不一定需要 Redux 了。`useReducer` + `useContext` 组合可以实现类似 Redux 的状态管理，适合中小型应用。

## useReducer 基础

```javascript
import { useReducer } from "react";

// reducer：纯函数，接收 state 和 action，返回新 state
function counterReducer(state, action) {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, count: state.count + 1 };
    case "DECREMENT":
      return { ...state, count: state.count - 1 };
    case "RESET":
      return { count: 0 };
    default:
      throw new Error(`未知 action: ${action.type}`);
  }
}

function Counter() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <div>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: "INCREMENT" })}>+</button>
      <button onClick={() => dispatch({ type: "DECREMENT" })}>-</button>
      <button onClick={() => dispatch({ type: "RESET" })}>重置</button>
    </div>
  );
}
```

## 结合 useContext 做全局状态

```javascript
// store/index.js
import React, { createContext, useContext, useReducer } from "react";

const StateContext = createContext(null);
const DispatchContext = createContext(null);

// 整个 app 的状态
const initialState = {
  user: null,
  theme: "light",
  notifications: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "TOGGLE_THEME":
      return { ...state, theme: state.theme === "light" ? "dark" : "light" };
    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (n) => n.id !== action.payload,
        ),
      };
    default:
      return state;
  }
}

// Provider 组件
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

// 自定义 Hook：分离 state 和 dispatch
export function useAppState() {
  return useContext(StateContext);
}

export function useAppDispatch() {
  return useContext(DispatchContext);
}

// 细粒度 Hook（避免无关 state 变化导致重渲染）
export function useUser() {
  const { user } = useAppState();
  return user;
}
```

```javascript
// 在组件中使用
function Header() {
  const user = useUser();
  const dispatch = useAppDispatch();

  return (
    <header>
      <span>欢迎, {user?.name}</span>
      <button onClick={() => dispatch({ type: "TOGGLE_THEME" })}>
        切换主题
      </button>
    </header>
  );
}

// 入口
function App() {
  return (
    <AppProvider>
      <Header />
      <Main />
    </AppProvider>
  );
}
```

## 异步 Action

这套方案没有 Redux middleware，异步逻辑放在自定义 Hook 里：

```javascript
function useUserActions() {
  const dispatch = useAppDispatch();

  const login = async (credentials) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const user = await api.login(credentials);
      dispatch({ type: "SET_USER", payload: user });
      dispatch({
        type: "ADD_NOTIFICATION",
        payload: { id: Date.now(), message: "登录成功" },
      });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: error.message });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = () => {
    api.logout();
    dispatch({ type: "SET_USER", payload: null });
  };

  return { login, logout };
}
```

## 和 Redux 比较

|            | useReducer + useContext    | Redux                     |
| ---------- | -------------------------- | ------------------------- |
| 学习成本   | 低（React 内置）           | 中（需要理解 middleware） |
| 样板代码   | 少                         | 多                        |
| 适合规模   | 中小型                     | 中大型                    |
| 开发者工具 | 无                         | Redux DevTools            |
| 性能       | Context 变更触发所有消费者 | 精确订阅                  |

小项目用 `useReducer + useContext`，大项目用 Redux Toolkit 或 Zustand（2022 年后的新选择）。

## 小结

- `useReducer` 适合状态转换逻辑复杂的场景（比多个 `useState` 清晰）
- `useContext` 传递 state 和 dispatch，避免 prop drilling
- state 和 dispatch 分两个 Context，避免只用 dispatch 的组件因 state 变化重渲染
- 异步逻辑封装在自定义 Hook 里，不放在 reducer 中
