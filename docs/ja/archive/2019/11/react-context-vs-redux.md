---
title: "React Context vs Redux：選択ガイド"
date: 2019-11-04 15:36:26
tags:
  - React
readingTime: 5
description: "React 16.3 で新しい Context API が導入され、多くの開発者が「Context があるのに、Redux はまだ必要か？」と考えるようになりました。この記事では両者の適用シーンを詳しく比較し、実際のプロジェクトで適切な技術選定ができるように支援します。"
wordCount: 927
---

React 16.3で全く新しいContext APIが導入され、多くの開発者が「Contextがあるのに、Reduxはまだ必要か？」と考えるようになりました。この記事では両者の適用シーンを詳しく比較し、実際のプロジェクトで適切な技術選定ができるように支援します。

## React Contextの基礎おさらい

Contextは、コンポーネンツリー内でデータを渡す方法を提供し、propsを階層ごとに渡す問題を解決します：

```jsx
{% raw %}
import React, { createContext, useContext, useState } from 'react';

// Contextを作成
const ThemeContext = createContext('light');

// Providerコンポーネント
function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// 中間コンポーネントはpropsを渡す必要がない
function Toolbar() {
  return <ThemedButton />;
}

// 消費コンポーネント
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

Reduxは予測可能な状態管理コンテナであり、単一のデータソース、読み取り専用の状態、純粋関数による変更の原則に従います：

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

// コンポーネントと接続
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

### 1. 更新メカニズム

Contextの更新は、そのContextを消費するすべてのコンポーネントの再レンダリングを引き起こします：

```jsx
{% raw %}
// 問題：ThemeContextが変化すると、countだけを気にするコンポーネントも再レンダリングされる
const AppContext = createContext();

function App() {
  const [theme, setTheme] = useState('light');
  const [count, setCount] = useState(0);

  return (
    <AppContext.Provider value={{ theme, setTheme, count, setCount }}>
      {/* themeとcountが同じContext内にある */}
      {/* countが変化すると、themeを消費するコンポーネントも再レンダリングされる */}
      <ThemeDisplay />
      <Counter />
    </AppContext.Provider>
  );
}

// このコンポーネントがthemeしか使っていなくても、countが変化すると再レンダリングされる
function ThemeDisplay() {
  const { theme } = useContext(AppContext);
  console.log('ThemeDisplay 重渲染了');
  return <div>当前主题: {theme}</div>;
}
{% endraw %}
```

Reduxの`connect`は浅い比較を使用するため、関連するデータが変化したときのみ再レンダリングが発生します：

```jsx
// state.themeが変化したときのみ、ThemeDisplayが再レンダリングされる
const ThemeDisplay = connect(
  state => ({ theme: state.theme })
)(({ theme }) => {
  console.log('ThemeDisplay 重渲染了');
  return <div>当前主题: {theme}</div>;
});
```

### 2. ミドルウェアと非同期

Contextには組み込みのミドルウェア機構がなく、非同期処理は自前で実装する必要があります：

```jsx
{% raw %}
// Contextでの非同期処理
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

Reduxには豊富なミドルウェアエコシステムがあります：

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

// redux-saga（より強力な非同期フロー制御）
function* fetchUserSaga(action) {
  try {
    const user = yield call(fetchUserApi, action.payload);
    yield put({ type: 'FETCH_USER_SUCCESS', payload: user });
  } catch (e) {
    yield put({ type: 'FETCH_USER_ERROR', payload: e.message });
  }
}
```

### 3. DevToolsのサポート

Reduxには強力なDevToolsがあり、タイムトラベルデバッグをサポートしています：

```jsx
// Redux DevToolsを有効化
const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);
```

Contextには公式のデバッグツールがありません。Contextの値が変化しても、どこでトリガーされたのか追跡するのが難しいです。

### 4. 状態の永続化

Reduxでは状態の永続化を簡単に実現できます：

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

Contextでは永続化ロジックを手動で実装する必要があります。

## 選び方

### Contextが適したシナリオ

```jsx
// シナリオ1：テーマ設定（低頻度の変更）
const ThemeContext = createContext();

// シナリオ2：国際化設定
const LocaleContext = createContext();

// シナリオ3：ユーザー認証情報（ログイン後に設定、ほとんど変更なし）
const AuthContext = createContext();

// シナリオ4：コンポーネントライブラリの設定注入
const ConfigProvider = ({ children, config }) => (
  <ConfigContext.Provider value={config}>
    {children}
  </ConfigContext.Provider>
);
```

特徴：
- データの変化頻度が低い
- 複雑な更新ロジックが不要
- ミドルウェアやDevToolsが不要
- 局所的なコンポーネンツリーでのみ使用

### Reduxが適したシナリオ

```jsx
// シナリオ1：ショッピングカート（頻繁な更新、複数コンポーネントが読み取り）
// シナリオ2：アプリケーションのグローバル状態（ユーザー、権限、通知など）
// シナリオ3：複雑な非同期フローが必要なビジネスロジック
// シナリオ4：タイムトラベルデバッグが必要
```

特徴：
- データの変化頻度が高い
- 関連性のない複数のコンポーネントが同じデータを読み取る必要がある
- ミドルウェア（非同期、ログ、永続化など）が必要
- 強力なデバッグツールが必要

## Context + useReducer：軽量な代替案

中程度の複雑さの状態管理であれば、Context + useReducerでReduxを代替できます：

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

// カスタムHooks
export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppDispatch() {
  return useContext(AppDispatchContext);
}

// 使用例
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

- Contextは低頻度で変化する設定系のデータ（テーマ、言語、認証）の受け渡しに適しています
- Reduxは頻繁に変化するグローバルな業務状態の管理に適しています
- Contextには組み込みのミドルウェアやDevToolsがなく、非同期処理やデバッグを自前で行う必要があります
- `connect`は浅い比較を使用して不必要な再レンダリングを防ぎますが、Contextは全ての消費者を再レンダリングします
- Context + useReducerは中程度の複雑さのシナリオにおける軽量な代替案です
- 技術選定はプロジェクトの規模、チームの経験、状態の複雑さに基づいて決定すべきです
