---
title: "React Context 性能优化指南"
date: 2019-05-13 10:48:53
tags:
  - React
readingTime: 5
description: "React 16.3 引入了新的 Context API，16.8 的 Hooks 让它更好用了。但在实际项目中，很多人发现用了 Context 后组件频繁重渲染，性能下降。这篇文章深入分析 Context 的渲染机制和优化方案。"
wordCount: 637
---

React 16.3 引入了新的 Context API，16.8 的 Hooks 让它更好用了。但在实际项目中，很多人发现用了 Context 后组件频繁重渲染，性能下降。这篇文章深入分析 Context 的渲染机制和优化方案。

## Context 的重渲染问题

先看一个典型的"掉坑"案例：

```jsx
{% raw %}
import React, { createContext, useState } from 'react'

const UserContext = createContext()

function App() {
  const [user, setUser] = useState({ name: '张三', age: 25 })
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
  return <div>用户名: {user.name}</div>
}

function ThemeSwitcher() {
  console.log('ThemeSwitcher render')
  const { theme, setTheme } = useContext(UserContext)
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      当前主题: {theme}
    </button>
  )
}
{% endraw %}
```

问题来了：点击切换主题时，`UserProfile` 也会重新渲染，尽管它只关心 `user`。因为 `ThemeSwitcher` 调用了 `setTheme`，导致 `value` 对象变化，所有 `useContext(UserContext)` 的消费者都会重渲染。

**核心原理：Context.Provider 的 value 变化时，所有 useContext 这个 Context 的组件都会重渲染，不管它们实际用了 value 中的哪些字段。**

## 方案一：拆分 Context

最直接的方案：不同关注点放在不同 Context 中。

```jsx
import React, { createContext, useState, useContext } from 'react'

// 按关注点拆分
const UserContext = createContext()
const ThemeContext = createContext()

function AppProvider({ children }) {
  const [user, setUser] = useState({ name: '张三', age: 25 })
  const [theme, setTheme] = useState('light')

  // 各自独立的 value
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
  return <div>用户名: {user.name}</div>
}

function ThemeSwitcher() {
  console.log('ThemeSwitcher render')
  const { theme, setTheme } = useContext(ThemeContext)
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      当前主题: {theme}
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

现在切换主题时，`UserProfile` 不再重渲染，因为它订阅的是 `UserContext`，而 `UserContext` 的 value 没变。

## 方案二：value 的稳定引用

即使拆分了 Context，如果 Provider 的 value 每次渲染都是新对象，消费者还是会重渲染。

```jsx
function AppProvider({ children }) {
  const [user, setUser] = useState({ name: '张三', age: 25 })

  // 问题：每次 AppProvider 重渲染，都会创建新的对象
  // const value = { user, setUser }

  // 解决：用 useMemo 缓存 value 对象
  const value = useMemo(() => ({ user, setUser }), [user])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}
```

`setUser` 来自 `useState`，引用本身是稳定的，所以依赖数组只需要 `[user]`。

## 方案三：useMemo 和 useCallback

对于 Context 中的函数，也需要保证引用稳定。

```jsx
import React, { createContext, useState, useMemo, useCallback } from 'react'

const TodoContext = createContext()

function TodoProvider({ children }) {
  const [todos, setTodos] = useState([])
  const [filter, setFilter] = useState('all')

  // 用 useCallback 确保函数引用稳定
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

  // 用 useMemo 缓存计算结果
  const filteredTodos = useMemo(() => {
    if (filter === 'active') return todos.filter(t => !t.done)
    if (filter === 'completed') return todos.filter(t => t.done)
    return todos
  }, [todos, filter])

  // 用 useMemo 缓存整个 value
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

## 方案四：React.memo 拦截

对于不使用 Context 但位于 Provider 下的组件，用 `React.memo` 防止不必要的渲染。

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

// 即使 TodoContext.value 变化导致 TodoList 重渲染被触发，
// React.memo 也拦截不了（因为 useContext 有变化时 memo 无效）
// 所以这个方案效果有限，主要保护的是纯展示子组件

// 真正有效的做法：把 Context 消费和渲染逻辑分离
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
      <button onClick={() => removeTodo(todo.id)}>删除</button>
    </li>
  )
}
```

## 方案五：拆分 Context 消费者

把组件拆成两层：外层订阅 Context，内层用 `React.memo`。

```jsx
// 内层：纯展示组件，用 memo 包裹
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

// 外层：只负责从 Context 取数据
function TodoListContainer() {
  const { todos, toggleTodo } = useContext(TodoContext)
  // 每次重渲染时 todos 引用可能变化
  // 但 TodoListView 用 memo 包裹，如果 props 没变就不会重渲染
  return <TodoListView todos={todos} onToggle={toggleTodo} />
}
```

如果 `todos` 数组引用稳定（比如通过 useMemo 缓存），`TodoListView` 就能真正避免重渲染。

## 完整实战：带优化的全局状态管理

下面是一个可直接用在项目中的方案。

```jsx
import React, {
  createContext,
  useReducer,
  useMemo,
  useCallback,
  useContext
} from 'react'

// 1. 定义 reducer
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

// 2. 拆分 Context：状态和 dispatch 分开
const AppStateContext = createContext()
const AppDispatchContext = createContext()

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  // dispatch 本身是稳定的，不需要 useMemo
  // 但将它放在独立 Context 中，状态变化不会影响只用 dispatch 的组件

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  )
}

// 3. 自定义 hooks：封装取值逻辑
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

// 4. 选择器模式：只订阅需要的 slice
function useAppSelector(selector) {
  const state = useAppState()
  return selector(state)
}

// 5. 使用示例

// 这个组件只读取 state，不读 dispatch
// 当只有 dispatch 不变时（永远不会变），不会触发重新渲染
function Header() {
  const user = useAppSelector(s => s.user)
  const theme = useAppSelector(s => s.theme)

  return (
    <header className={`header-${theme}`}>
      <span>{user ? user.name : '未登录'}</span>
    </header>
  )
}

// 这个组件只用 dispatch，state 变化不影响它
function ThemeButton() {
  console.log('ThemeButton render') // 只在父组件重渲染时才触发
  const dispatch = useAppDispatch()

  return (
    <button onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
      切换主题
    </button>
  )
}

// 使用 useReducer 的好处：dispatch 引用永远不变
// 配合拆分的 Context，只用 dispatch 的组件永远不会因 Context 变化而重渲染
```

## Context vs Redux：何时用哪个

在 Hooks 时代，很多人问"还需要 Redux 吗？"，答案取决于场景。

```jsx
{% raw %}
// 适合 Context 的场景：低频更新的全局配置
// 主题、语言、用户信息等
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
// 这类数据更新频率低，Context 的性能问题不明显

// 适合 Redux 的场景：高频更新的复杂状态
// 购物车、实时数据、多模块联动等
// - Redux 的 useSelector 有内置的引用比较，只在选择数据变化时重渲染
// - Redux DevTools 强大的调试能力
// - middleware 生态（thunk、saga、observable）
// - 更严格的单向数据流，团队协作更易维护
{% endraw %}
```

**我的经验法则：**

- 全局配置类（主题、语言、权限）→ Context + useState
- 中等复杂度状态（2-3 个模块联动）→ Context + useReducer
- 复杂状态管理（多模块、高频更新、需要中间件）→ Redux 或 MobX

## 小结

- Context.Provider 的 value 变化会导致**所有消费者**重渲染，这是性能问题的根源
- 拆分 Context 是最有效的方案：不同关注点放在不同 Context 中
- 用 `useMemo` 缓存 value 对象，用 `useCallback` 稳定函数引用
- 拆分 state 和 dispatch 到不同 Context，配合 `useReducer` 实现最优更新
- Context 适合低频更新的全局配置，复杂状态管理仍推荐 Redux
