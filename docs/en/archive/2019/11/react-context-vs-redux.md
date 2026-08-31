---
title: "React Context vs Redux: Selection Guide"
date: 2019-11-04 15:36:26
tags:
  - React
readingTime: 4
description: "React 16.3 introduced a brand-new Context API, making many developers wonder: with Context available, do we still need Redux? This article compares the two in depth so you can make the right architectural choice in your own projects."
wordCount: 332
---

React 16.3 introduced a brand-new Context API, making many developers wonder: with Context available, do we still need Redux? This article compares the two in depth so you can make the right architectural choice in your own projects.

## React Context Basics Review

Context provides a way to pass data through the component tree without threading props down at every level:

```jsx
{% raw %}
import React, { createContext, useContext, useState } from 'react';

// 创建 Context
const ThemeContext = createContext('light');

// Provider 组件
function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// 中间组件不需要传递 props
function Toolbar() {
  return <ThemedButton />;
}

// 消费组件
function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button
      className={`btn-${theme}`}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      切换主题
    </button>
  );
}
{% endraw %}
```

## Redux Basics Review

Redux is a predictable state container that follows the principles of a single source of truth, read-only state, and changes made by pure functions:

```jsx
import { createStore } from 'redux';
import { Provider, connect } from 'react-redux';

// Action Types
const INCREMENT = 'INCREMENT';
const SET_THEME = 'SET_THEME';

// Reducer
function rootReducer(state = { count: 0, theme: 'light' }, action) {
  switch (action.type) {
    case INCREMENT:
      return { ...state, count: state.count + 1 };
    case SET_THEME:
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

// Store
const store = createStore(rootReducer);

// Provider
function App() {
  return (
    <Provider store={store}>
      <Counter />
    </Provider>
  );
}

// 连接组件
function Counter({ count, increment }) {
  return (
    <div>
      <p>计数: {count}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
}

const ConnectedCounter = connect(
  state => ({ count: state.count }),
  dispatch => ({ increment: () => dispatch({ type: INCREMENT }) })
)(Counter);
```

## Core Differences Comparison

### 1. Update Mechanism

A Context update re-renders every component that consumes that Context:

```jsx
{% raw %}
// 问题：ThemeContext 变化时，即使只关心 count 的组件也会重渲染
const AppContext = createContext();

function App() {
  const [theme, setTheme] = useState('light');
  const [count, setCount] = useState(0);

  return (
    <AppContext.Provider value={{ theme, setTheme, count, setCount }}>
      {/* theme 和 count 都在同一个 Context 中 */}
      {/* count 变化时，消费 theme 的组件也会重渲染 */}
      <ThemeDisplay />
      <Counter />
    </AppContext.Provider>
  );
}

// 即使这个组件只用 theme，count 变化时也会重渲染
function ThemeDisplay() {
  const { theme } = useContext(AppContext);
  console.log('ThemeDisplay 重渲染了');
  return <div>当前主题: {theme}</div>;
}
{% endraw %}
```

Redux's `connect` uses shallow comparison, so a re-render is triggered only when the relevant data changes:

```jsx
// 只有 state.theme 变化时，ThemeDisplay 才会重渲染
const ThemeDisplay = connect(
  state => ({ theme: state.theme })
)(({ theme }) => {
  console.log('ThemeDisplay 重渲染了');
  return <div>当前主题: {theme}</div>;
});
```

### 2. Middleware and Async

Context has no built-in middleware mechanism; you have to implement async handling yourself:

```jsx
{% raw %}
// Context 中处理异步
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchUser(id) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/user/${id}`);
      const data = await response.json();
      setUser(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppContext.Provider value={{ user, loading, error, fetchUser }}>
      {children}
    </AppContext.Provider>
  );
}
{% endraw %}
```

Redux has a rich middleware ecosystem:

```jsx
// redux-thunk
function fetchUser(id) {
  return async (dispatch) => {
    dispatch({ type: 'FETCH_USER_START' });
    try {
      const response = await fetch(`/api/user/${id}`);
      const data = await response.json();
      dispatch({ type: 'FETCH_USER_SUCCESS', payload: data });
    } catch (e) {
      dispatch({ type: 'FETCH_USER_ERROR', payload: e.message });
    }
  };
}

// redux-saga（更强大的异步流控制）
function* fetchUserSaga(action) {
  try {
    const user = yield call(fetchUserApi, action.payload);
    yield put({ type: 'FETCH_USER_SUCCESS', payload: user });
  } catch (e) {
    yield put({ type: 'FETCH_USER_ERROR', payload: e.message });
  }
}
```

### 3. DevTools Support

Redux ships with powerful DevTools that support time-travel debugging:

```jsx
// 启用 Redux DevTools
const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);
```

Context has no official debugging tool. Every time a Context value changes, it's hard to trace where the change was triggered.

### 4. State Persistence

Redux makes state persistence straightforward:

```jsx
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'settings'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);
const store = createStore(persistedReducer);
const persistor = persistStore(store);
```

With Context you have to implement persistence logic by hand.

## How to Choose

### When to Use Context

```jsx
// 场景1：主题配置（低频变化）
const ThemeContext = createContext();

// 场景2：国际化配置
const LocaleContext = createContext();

// 场景3：用户认证信息（登录后设置，很少变化）
const AuthContext = createContext();

// 场景4：组件库的配置注入
const ConfigProvider = ({ children, config }) => (
  <ConfigContext.Provider value={config}>
    {children}
  </ConfigContext.Provider>
);
```

Characteristics:
- Data changes infrequently
- No complex update logic needed
- No middleware or DevTools required
- Used only within a local part of the component tree

### When to Use Redux

```jsx
// 场景1：购物车（频繁更新，多个组件读取）
// 场景2：应用全局状态（用户、权限、通知等）
// 场景3：需要复杂异步流的业务逻辑
// 场景4：需要时间旅行调试
```

Characteristics:
- Data changes frequently
- Multiple unrelated components need to read the same data
- Middleware is needed (async, logging, persistence, etc.)
- Powerful debugging tools are needed

## Context + useReducer: Lightweight Alternative

For medium-complexity state management, Context + useReducer can replace Redux:

```jsx
import React, { createContext, useContext, useReducer } from 'react';

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    default:
      return state;
  }
}

// Context
const AppStateContext = createContext();
const AppDispatchContext = createContext();

// Provider
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, {
    user: null,
    notifications: [],
  });

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// 自定义 Hooks
export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppDispatch() {
  return useContext(AppDispatchContext);
}

// 使用
function NotificationList() {
  const { notifications } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <ul>
      {notifications.map(n => (
        <li key={n.id}>
          {n.message}
          <button onClick={() => dispatch({
            type: 'REMOVE_NOTIFICATION',
            payload: n.id
          })}>
            关闭
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## Summary

- Context suits low-frequency configuration data (theme, locale, auth)
- Redux suits frequently changing global business state
- Context has no built-in middleware or DevTools; you handle async and debugging yourself
- `connect` uses shallow comparison to avoid needless re-renders, whereas Context re-renders all consumers
- Context + useReducer is a lightweight alternative for medium-complexity scenarios
- The right choice depends on project size, team experience, and state complexity
