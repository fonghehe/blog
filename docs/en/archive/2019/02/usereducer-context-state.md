---
title: "Lightweight State Management with useReducer + useContext"
date: 2019-02-14 15:47:39
tags:
  - Frontend
readingTime: 1
description: "With Hooks, small projects may not need Redux at all. The `useReducer` + `useContext` combination can implement Redux-like state management, suitable for small-"
---

With Hooks, small projects may not need Redux at all. The `useReducer` + `useContext` combination can implement Redux-like state management, suitable for small-to-medium applications.

## useReducer Basics

```javascript
import { useReducer } from "react";

// reducer: a pure function that receives state and action and returns a new state
function counterReducer(state, action) {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, count: state.count + 1 };
    case "DECREMENT":
      return { ...state, count: state.count - 1 };
    case "RESET":
      return { count: 0 };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

function Counter() {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <div>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: "INCREMENT" })}>+</button>
      <button onClick={() => dispatch({ type: "DECREMENT" })}>-</button>
      <button onClick={() => dispatch({ type: "RESET" })}>Reset</button>
    </div>
  );
}
```

## Combining with useContext for Global State

```javascript
// store/index.js
import React, { createContext, useContext, useReducer } from "react";

const StateContext = createContext(null);
const DispatchContext = createContext(null);

// App-wide state
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

// Provider component
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

// Custom Hooks: separate state and dispatch
export function useAppState() {
  return useContext(StateContext);
}

export function useAppDispatch() {
```
