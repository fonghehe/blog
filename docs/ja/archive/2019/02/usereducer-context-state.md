---
title: "useReducer + useContextで軽量状態管理を実現する"
date: 2019-02-14 15:47:39
tags:
  - フロントエンド
readingTime: 1
description: "Hooksを使えば、小規模プロジェクトはReduxが不要になるかもしれない。`useReducer` + `useContext`の組み合わせでReduxライクな状態管理が実現でき、中小規模のアプリケーションに適している。"
---

Hooksを使えば、小規模プロジェクトはReduxが不要になるかもしれない。`useReducer` + `useContext`の組み合わせでReduxライクな状態管理が実現でき、中小規模のアプリケーションに適している。

## useReducerの基礎

```javascript
import { useReducer } from "react";

// reducer：stateとactionを受け取り新しいstateを返す純粋関数
function counterReducer(state, action) {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, count: state.count + 1 };
    case "DECREMENT":
      return { ...state, count: state.count - 1 };
    case "RESET":
      return { count: 0 };
    default:
      throw new Error(`不明なアクション: ${action.type}`);
  }
}

function Counter() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <div>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: "INCREMENT" })}>+</button>
      <button onClick={() => dispatch({ type: "DECREMENT" })}>-</button>
      <button onClick={() => dispatch({ type: "RESET" })}>リセット</button>
    </div>
  );
}
```

## useContextと組み合わせてグローバル状態を管理

```javascript
// store/index.js
import React, { createContext, useContext, useReducer } from "react";

const StateContext = createContext(null);
const DispatchContext = createContext(null);

// アプリ全体の状態
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

// Providerコンポーネント
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

// カスタムフック：stateとdispatchを分離
export function useAppState() {
  return useContext(StateContext);
}

export function useAppDispatch() {
```
