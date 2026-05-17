---
title: "React Context vs Redux：選択ガイド"
date: 2019-11-04 15:36:26
tags:
  - React
readingTime: 4
description: "React 16.3 引入了全新的 Context API，让很多开发者开始思考：有了 Context，还需要 Redux 吗？本文将深入对比两者的适用场景，帮助你在实际项目中做出正确的技术选型。"
---

React 16.3 引入了全新的 Context API，让很多开发者开始思考：有了 Context，还需要 Redux 吗？本文将深入对比两者的适用场景，帮助你在实际项目中做出正确的技术选型。

## React Contextの基礎おさらい

Context 提供了一种在组件树中传递数据的方式，避免了逐层传递 props 的问题：

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

## Reduxの基礎おさらい

Redux 是一个可预测的状态管理容器，遵循单一数据源、只读状态、纯函数修改的原则：

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

## コアの相違点比較

### 1. 更新机制

Context 的更新会导致所有消费该 Context 的组件重新渲染：

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

Redux 的 `connect` 使用浅比较，只有相关数据变化时才触发重渲染：

```jsx
// 只有 state.theme 变化时，ThemeDisplay 才会重渲染
const ThemeDisplay = connect(
  state => ({ theme: state.theme })
)(({ theme }) => {
  console.log('ThemeDisplay 重渲染了');
  return <div>当前主题: {theme}</div>;
});
```

### 2. 中间件与异步

Context 没有内置的中间件机制，异步处理需要自己实现：

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

Redux 有丰富的中间件生态：

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

### 3. DevTools 支持

Redux 有强大的 DevTools，支持时间旅行调试：

```jsx
// 启用 Redux DevTools
const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);
```

Context 没有官方的调试工具。每次 Context 值变化都很难追踪是哪里触发的。

### 4. 状态持久化

Redux 可以轻松实现状态持久化：

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

Context 需要手动实现持久化逻辑。

## 選び方

### 适合使用 Context 的场景

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

特征：
- 数据变化频率低
- 不需要复杂的更新逻辑
- 不需要中间件和 DevTools
- 只在局部组件树中使用

### 适合使用 Redux 的场景

```jsx
// 场景1：购物车（频繁更新，多个组件读取）
// 场景2：应用全局状态（用户、权限、通知等）
// 场景3：需要复杂异步流的业务逻辑
// 场景4：需要时间旅行调试
```

特征：
- 数据变化频率高
- 多个不相关的组件需要读取同一份数据
- 需要中间件（异步、日志、持久化等）
- 需要强大的调试工具

## Context + useReducer：軽量な代替案

对于中等复杂度的状态管理，Context + useReducer 可以替代 Redux：

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

## まとめ

- Context 适合传递低频变化的配置类数据（主题、语言、认证）
- Redux 适合管理频繁变化的全局业务状态
- Context 没有内置中间件和 DevTools，需要自行处理异步和调试
- `connect` 使用浅比较避免不必要的重渲染，Context 会触发所有消费者重渲染
- Context + useReducer 是中等复杂度场景的轻量级替代方案
- 技术选型应根据项目规模、团队经验和状态复杂度来决定
