---
title: "React Context 效能最佳化指南"
date: 2019-05-13 10:48:53
tags:
  - React
readingTime: 5
description: "React 16.3 引入了新的 Context API，16.8 的 Hooks 讓它更好用了。但在實際專案中，很多人發現用了 Context 後元件頻繁重渲染，效能下降。這篇文章深入分析 Context 的渲染機製和最佳化方案。"
wordCount: 644
---

React 16.3 引入了新的 Context API，16.8 的 Hooks 讓它更好用了。但在實際專案中，很多人發現用了 Context 後元件頻繁重渲染，效能下降。這篇文章深入分析 Context 的渲染機製和最佳化方案。

## Context 的重渲染問題

先看一個典型的"掉坑"案例：

```jsx
{% raw %}
import React, { createContext, useState } from 'react'

const UserContext = createContext()

function App() {
  const [user, setUser] = useState({ name: '張三', age: 25 })
  const [theme, setTheme] = useState('light')

  console.log('App render')

  return (
    <UserContext.Provider value={{ user, setUser, theme, setTheme }}>
      <UserProfile />
      <ThemeSwitcher />
    </UserContext.Provider>
  )
}

function UserProfile() {
  console.log('UserProfile render')
  const { user } = useContext(UserContext)
  return <div>使用者名稱: {user.name}</div>
}

function ThemeSwitcher() {
  console.log('ThemeSwitcher render')
  const { theme, setTheme } = useContext(UserContext)
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      當前主題: {theme}
    </button>
  )
}
{% endraw %}
```

問題來了：點選切換主題時，`UserProfile` 也會重新渲染，儘管它隻關心 `user`。因為 `ThemeSwitcher` 呼叫了 `setTheme`，導致 `value` 物件變化，所有 `useContext(UserContext)` 的消費者都會重渲染。

**核心原理：Context.Provider 的 value 變化時，所有 useContext 這個 Context 的元件都會重渲染，不管它們實際用了 value 中的哪些欄位。**

## 方案一：拆分 Context

最直接的方案：不同關注點放在不同 Context 中。

```jsx
import React, { createContext, useState, useContext } from 'react'

// 按關注點拆分
const UserContext = createContext()
const ThemeContext = createContext()

function AppProvider({ children }) {
  const [user, setUser] = useState({ name: '張三', age: 25 })
  const [theme, setTheme] = useState('light')

  // 各自獨立的 value
  const userValue = { user, setUser }
  const themeValue = { theme, setTheme }

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  )
}

function UserProfile() {
  console.log('UserProfile render')
  const { user } = useContext(UserContext)
  return <div>使用者名稱: {user.name}</div>
}

function ThemeSwitcher() {
  console.log('ThemeSwitcher render')
  const { theme, setTheme } = useContext(ThemeContext)
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      當前主題: {theme}
    </button>
  )
}

// App 使用
function App() {
  return (
    <AppProvider>
      <UserProfile />
      <ThemeSwitcher />
    </AppProvider>
  )
}
```

現在切換主題時，`UserProfile` 不再重渲染，因為它訂閱的是 `UserContext`，而 `UserContext` 的 value 沒變。

## 方案二：value 的穩定引用

即使拆分了 Context，如果 Provider 的 value 每次渲染都是新物件，消費者還是會重渲染。

```jsx
function AppProvider({ children }) {
  const [user, setUser] = useState({ name: '張三', age: 25 })

  // 問題：每次 AppProvider 重渲染，都會建立新的物件
  // const value = { user, setUser }

  // 解決：用 useMemo 快取 value 物件
  const value = useMemo(() => ({ user, setUser }), [user])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}
```

`setUser` 來自 `useState`，引用本身是穩定的，所以依賴陣列隻需要 `[user]`。

## 方案三：useMemo 和 useCallback

對於 Context 中的函式，也需要保證引用穩定。

```jsx
import React, { createContext, useState, useMemo, useCallback } from 'react'

const TodoContext = createContext()

function TodoProvider({ children }) {
  const [todos, setTodos] = useState([])
  const [filter, setFilter] = useState('all')

  // 用 useCallback 確保函式引用穩定
  const addTodo = useCallback((text) => {
    setTodos(prev => [
      ...prev,
      { id: Date.now(), text, done: false }
    ])
  }, [])

  const toggleTodo = useCallback((id) => {
    setTodos(prev =>
      prev.map(t => t.id === id ? { ...t, done: !t.done } : t)
    )
  }, [])

  const removeTodo = useCallback((id) => {
    setTodos(prev => prev.filter(t => t.id !== id))
  }, [])

  // 用 useMemo 快取計算結果
  const filteredTodos = useMemo(() => {
    if (filter === 'active') return todos.filter(t => !t.done)
    if (filter === 'completed') return todos.filter(t => t.done)
    return todos
  }, [todos, filter])

  // 用 useMemo 快取整個 value
  const value = useMemo(() => ({
    todos: filteredTodos,
    filter,
    setFilter,
    addTodo,
    toggleTodo,
    removeTodo,
    total: todos.length,
    remaining: todos.filter(t => !t.done).length
  }), [filteredTodos, filter, addTodo, toggleTodo, removeTodo, todos.length])

  return (
    <TodoContext.Provider value={value}>
      {children}
    </TodoContext.Provider>
  )
}
```

## 方案四：React.memo 攔截

對於不使用 Context 但位於 Provider 下的元件，用 `React.memo` 防止不必要的渲染。

```jsx
const TodoList = React.memo(function TodoList() {
  console.log('TodoList render')
  const { todos, toggleTodo } = useContext(TodoContext)

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.done}
            onChange={() => toggleTodo(todo.id)}
          />
          {todo.text}
        </li>
      ))}
    </ul>
  )
})

// 即使 TodoContext.value 變化導致 TodoList 重渲染被觸發，
// React.memo 也攔截不了（因為 useContext 有變化時 memo 無效）
// 所以這個方案效果有限，主要保護的是純展示子元件

// 真正有效的做法：把 Context 消費和渲染邏輯分離
function TodoItem({ id }) {
  const { toggleTodo, removeTodo } = useContext(TodoContext)
  const todo = useContext(TodoContext).todos.find(t => t.id === id)

  return (
    <li>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => toggleTodo(todo.id)}
      />
      {todo.text}
      <button onClick={() => removeTodo(todo.id)}>刪除</button>
    </li>
  )
}
```

## 方案五：拆分 Context 消費者

把元件拆成兩層：外層訂閱 Context，內層用 `React.memo`。

```jsx
// 內層：純展示元件，用 memo 包裹
const TodoListView = React.memo(function TodoListView({ todos, onToggle }) {
  console.log('TodoListView render')
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.done}
            onChange={() => onToggle(todo.id)}
          />
          {todo.text}
        </li>
      ))}
    </ul>
  )
})

// 外層：隻負責從 Context 取資料
function TodoListContainer() {
  const { todos, toggleTodo } = useContext(TodoContext)
  // 每次重渲染時 todos 引用可能變化
  // 但 TodoListView 用 memo 包裹，如果 props 沒變就不會重渲染
  return <TodoListView todos={todos} onToggle={toggleTodo} />
}
```

如果 `todos` 陣列引用穩定（比如通過 useMemo 快取），`TodoListView` 就能真正避免重渲染。

## 完整實戰：帶最佳化的全域性狀態管理

下面是一個可直接用在專案中的方案。

```jsx
import React, {
  createContext,
  useReducer,
  useMemo,
  useCallback,
  useContext
} from 'react'

// 1. 定義 reducer
const initialState = {
  user: null,
  theme: 'light',
  notifications: []
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' }
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [...state.notifications, action.payload] }
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      }
    default:
      return state
  }
}

// 2. 拆分 Context：狀態和 dispatch 分開
const AppStateContext = createContext()
const AppDispatchContext = createContext()

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // dispatch 本身是穩定的，不需要 useMemo
  // 但將它放在獨立 Context 中，狀態變化不會影響隻用 dispatch 的元件

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  )
}

// 3. 自定義 hooks：封裝取值邏輯
function useAppState() {
  const context = useContext(AppStateContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within AppProvider')
  }
  return context
}

function useAppDispatch() {
  const context = useContext(AppDispatchContext)
  if (context === undefined) {
    throw new Error('useAppDispatch must be used within AppProvider')
  }
  return context
}

// 4. 選擇器模式：隻訂閱需要的 slice
function useAppSelector(selector) {
  const state = useAppState()
  return selector(state)
}

// 5. 使用示例

// 這個元件隻讀取 state，不讀 dispatch
// 當隻有 dispatch 不變時（永遠不會變），不會觸發重新渲染
function Header() {
  const user = useAppSelector(s => s.user)
  const theme = useAppSelector(s => s.theme)

  return (
    <header className={`header-${theme}`}>
      <span>{user ? user.name : '未登入'}</span>
    </header>
  )
}

// 這個元件隻用 dispatch，state 變化不影響它
function ThemeButton() {
  console.log('ThemeButton render') // 隻在父元件重渲染時才觸發
  const dispatch = useAppDispatch()

  return (
    <button onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
      切換主題
    </button>
  )
}

// 使用 useReducer 的好處：dispatch 引用永遠不變
// 配合拆分的 Context，隻用 dispatch 的元件永遠不會因 Context 變化而重渲染
```

## Context vs Redux：何時用哪個

在 Hooks 時代，很多人問"還需要 Redux 嗎？"，答案取決於場景。

```jsx
{% raw %}
// 適合 Context 的場景：低頻更新的全域性配置
// 主題、語言、使用者資訊等
const ConfigContext = createContext()

function ConfigProvider({ children }) {
  const [config, setConfig] = useState({
    locale: 'zh-CN',
    theme: 'light',
    sidebarCollapsed: false
  })
  return (
    <ConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </ConfigContext.Provider>
  )
}
// 這類資料更新頻率低，Context 的效能問題不明顯

// 適合 Redux 的場景：高頻更新的複雜狀態
// 購物車、即時資料、多模組聯動等
// - Redux 的 useSelector 有內建的引用比較，隻在選擇資料變化時重渲染
// - Redux DevTools 強大的除錯能力
// - middleware 生態（thunk、saga、observable）
// - 更嚴格的單向資料流，團隊協作更易維護
{% endraw %}
```

**我的經驗法則：**

- 全域性配置類（主題、語言、許可權）→ Context + useState
- 中等複雜度狀態（2-3 個模組聯動）→ Context + useReducer
- 複雜狀態管理（多模組、高頻更新、需要中介軟體）→ Redux 或 MobX

## 小結

- Context.Provider 的 value 變化會導致**所有消費者**重渲染，這是效能問題的根源
- 拆分 Context 是最有效的方案：不同關注點放在不同 Context 中
- 用 `useMemo` 快取 value 物件，用 `useCallback` 穩定函式引用
- 拆分 state 和 dispatch 到不同 Context，配合 `useReducer` 實現最優更新
- Context 適合低頻更新的全域性配置，複雜狀態管理仍推薦 Redux
