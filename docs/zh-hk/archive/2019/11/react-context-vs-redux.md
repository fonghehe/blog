---
title: "React Context vs Redux 選擇指南：落地路徑與實戰建議"
date: 2019-11-04 15:36:26
tags:
  - React
readingTime: 4
description: "React 16.3 引入了全新的 Context API，讓很多開發者開始思考：有了 Context，還需要 Redux 嗎？本文將深入對比兩者的適用場景，幫助你在實際項目中做出正確的技術選型。"
wordCount: 582
---

React 16.3 引入了全新的 Context API，讓很多開發者開始思考：有了 Context，還需要 Redux 嗎？本文將深入對比兩者的適用場景，幫助你在實際項目中做出正確的技術選型。

## React Context 基礎回顧

Context 提供了一種在組件樹中傳遞數據的方式，避免了逐層傳遞 props 的問題：

```jsx
{% raw %}
import React, { createContext, useContext, useState } from 'react';

// 創建 Context
const ThemeContext = createContext('light');

// Provider 組件
function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// 中間組件不需要傳遞 props
function Toolbar() {
  return <ThemedButton />;
}

// 消費組件
function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button
      className={`btn-${theme}`}
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      切換主題
    </button>
  );
}
{% endraw %}
```

## Redux 基礎回顧

Redux 是一個可預測的狀態管理容器，遵循單一數據源、隻讀狀態、純函數修改的原則：

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

// 連接組件
function Counter({ count, increment }) {
  return (
    <div>
      <p>計數: {count}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
}

const ConnectedCounter = connect(
  state => ({ count: state.count }),
  dispatch => ({ increment: () => dispatch({ type: INCREMENT }) })
)(Counter);
```

## 核心差異對比

### 1. 更新機製

Context 的更新會導致所有消費該 Context 的組件重新渲染：

```jsx
{% raw %}
// 問題：ThemeContext 變化時，即使隻關心 count 的組件也會重渲染
const AppContext = createContext();

function App() {
  const [theme, setTheme] = useState('light');
  const [count, setCount] = useState(0);

  return (
    <AppContext.Provider value={{ theme, setTheme, count, setCount }}>
      {/* theme 和 count 都在同一個 Context 中 */}
      {/* count 變化時，消費 theme 的組件也會重渲染 */}
      <ThemeDisplay />
      <Counter />
    </AppContext.Provider>
  );
}

// 即使這個組件隻用 theme，count 變化時也會重渲染
function ThemeDisplay() {
  const { theme } = useContext(AppContext);
  console.log('ThemeDisplay 重渲染了');
  return <div>當前主題: {theme}</div>;
}
{% endraw %}
```

Redux 的 `connect` 使用淺比較，隻有相關數據變化時才觸發重渲染：

```jsx
// 隻有 state.theme 變化時，ThemeDisplay 才會重渲染
const ThemeDisplay = connect(
  state => ({ theme: state.theme })
)(({ theme }) => {
  console.log('ThemeDisplay 重渲染了');
  return <div>當前主題: {theme}</div>;
});
```

### 2. 中間件與異步

Context 沒有內置的中間件機製，異步處理需要自己實現：

```jsx
{% raw %}
// Context 中處理異步
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

Redux 有豐富的中間件生態：

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

// redux-saga（更強大的異步流控製）
function* fetchUserSaga(action) {
  try {
    const user = yield call(fetchUserApi, action.payload);
    yield put({ type: 'FETCH_USER_SUCCESS', payload: user });
  } catch (e) {
    yield put({ type: 'FETCH_USER_ERROR', payload: e.message });
  }
}
```

### 3. DevTools 支援

Redux 有強大的 DevTools，支持時間旅行調試：

```jsx
// 啓用 Redux DevTools
const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);
```

Context 沒有官方的調試工具。每次 Context 值變化都很難追蹤是哪裏觸發的。

### 4. 狀態持久化

Redux 可以輕鬆實現狀態持久化：

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

Context 需要手動實現持久化邏輯。

## 如何選擇

### 適合使用 Context 的場景

```jsx
// 場景1：主題配置（低頻變化）
const ThemeContext = createContext();

// 場景2：國際化配置
const LocaleContext = createContext();

// 場景3：用户認證信息（登錄後設置，很少變化）
const AuthContext = createContext();

// 場景4：組件庫的配置注入
const ConfigProvider = ({ children, config }) => (
  <ConfigContext.Provider value={config}>
    {children}
  </ConfigContext.Provider>
);
```

特徵：
- 數據變化頻率低
- 不需要複雜的更新邏輯
- 不需要中間件和 DevTools
- 隻在局部組件樹中使用

### 適合使用 Redux 的場景

```jsx
// 場景1：購物車（頻繁更新，多個組件讀取）
// 場景2：應用全局狀態（用户、權限、通知等）
// 場景3：需要複雜異步流的業務邏輯
// 場景4：需要時間旅行調試
```

特徵：
- 數據變化頻率高
- 多個不相關的組件需要讀取同一份數據
- 需要中間件（異步、日誌、持久化等）
- 需要強大的調試工具

## Context + useReducer：輕量級替代方案

對於中等複雜度的狀態管理，Context + useReducer 可以替代 Redux：

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

// 自定義 Hooks
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
            關閉
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## 小結

- Context 適合傳遞低頻變化的配置類數據（主題、語言、認證）
- Redux 適合管理頻繁變化的全局業務狀態
- Context 沒有內置中間件和 DevTools，需要自行處理異步和調試
- `connect` 使用淺比較避免不必要的重渲染，Context 會觸發所有消費者重渲染
- Context + useReducer 是中等複雜度場景的輕量級替代方案
- 技術選型應根據項目規模、團隊經驗和狀態複雜度來決定
