---
title: "useReducer + useContext 實現輕量狀態管理"
date: 2019-02-14 15:47:39
tags:
  - 前端
readingTime: 2
description: "有了 Hooks，小項目不一定需要 Redux 了。`useReducer` + `useContext` 組合可以實現類似 Redux 的狀態管理，適合中小型應用。"
---

有了 Hooks，小項目不一定需要 Redux 了。`useReducer` + `useContext` 組合可以實現類似 Redux 的狀態管理，適合中小型應用。

## useReducer 基礎

```javascript
import { useReducer } from "react";

// reducer：純函數，接收 state 和 action，返回新 state
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

## 結合 useContext 做全局狀態

```javascript
// store/index.js
import React, { createContext, useContext, useReducer } from "react";

const StateContext = createContext(null);
const DispatchContext = createContext(null);

// 整個 app 的狀態
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

// Provider 組件
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

// 自定義 Hook：分離 state 和 dispatch
export function useAppState() {
  return useContext(StateContext);
}

export function useAppDispatch() {
  return useContext(DispatchContext);
}

// 細粒度 Hook（避免無關 state 變化導致重渲染）
export function useUser() {
  const { user } = useAppState();
  return user;
}
```

```javascript
// 在組件中使用
function Header() {
  const user = useUser();
  const dispatch = useAppDispatch();

  return (
    <header>
      <span>歡迎, {user?.name}</span>
      <button onClick={() => dispatch({ type: "TOGGLE_THEME" })}>
        切換主題
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

## 異步 Action

這套方案沒有 Redux middleware，異步邏輯放在自定義 Hook 裏：

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
        payload: { id: Date.now(), message: "登錄成功" },
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

## 和 Redux 比較

|            | useReducer + useContext    | Redux                     |
| 
---------- | -------------------------- | ------------------------- |
| 學習成本   | 低（React 內置）           | 中（需要理解 middleware） |
| 樣板代碼   | 少                         | 多                        |
| 適合規模   | 中小型                     | 中大型                    |
| 開發者工具 | 無                         | Redux DevTools            |
| 性能       | Context 變更觸發所有消費者 | 精確訂閲                  |

小項目用 `useReducer + useContext`，大項目用 Redux Toolkit 或 Zustand（2022 年後的新選擇）。

## 小結

- `useReducer` 適合狀態轉換邏輯複雜的場景（比多個 `useState` 清晰）
- `useContext` 傳遞 state 和 dispatch，避免 prop drilling
- state 和 dispatch 分兩個 Context，避免只用 dispatch 的組件因 state 變化重渲染
- 異步邏輯封裝在自定義 Hook 裏，不放在 reducer 中
