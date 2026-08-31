---
title: "React Testing Library Testing Guide"
date: 2019-12-09 15:47:43
tags:
  - React
readingTime: 3
description: "This year, as the team pushed unit testing forward, we migrated from Enzyme to React Testing Library (RTL). Enzyme is powerful, but its API encourages testing implementation details—component internal state, instance methods—which makes tests break frequently during refactoring. React Testing Library takes a completely different philosophy: **test user behavior, not implementation details**."
wordCount: 239
---

This year, as the team pushed unit testing forward, we migrated from Enzyme to React Testing Library (RTL). Enzyme is powerful, but its API encourages testing implementation details—component internal state, instance methods—which makes tests break frequently during refactoring. React Testing Library takes a completely different philosophy: **test user behavior, not implementation details**.

## Core Philosophy

React Testing Library's design philosophy can be summed up in one sentence: **the more your tests resemble the way software is used, the more confidence they give you.**

```jsx
// Enzyme 风格：测试实现细节（不推荐）
import { shallow } from 'enzyme'

test('点击按钮增加计数', () => {
  const wrapper = shallow(<Counter />)
  expect(wrapper.state('count')).toBe(0)
  wrapper.instance().handleClick()
  expect(wrapper.state('count')).toBe(1)
})

// React Testing Library 风格：测试用户行为（推荐）
import { render, screen, fireEvent } from '@testing-library/react'

test('点击按钮增加计数', () => {
  render(<Counter />)
  const button = screen.getByRole('button', { name: /计数/i })
  expect(button).toHaveTextContent('计数: 0')

  fireEvent.click(button)
  expect(button).toHaveTextContent('计数: 1')
})
```

## Query Priority: getBy / queryBy / findBy

RTL provides three families of query methods, each suited to different situations. The officially recommended priority order is:

```jsx
import { render, screen, waitFor } from '@testing-library/react'

function UserProfile({ userId }) {
  const [user, setUser] = React.useState(null)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
  }, [userId])

  if (error) return <div role="alert">加载失败</div>
  if (!user) return <div>加载中...</div>

  return (
    <div>
      <h1>{user.name}</h1>
      <p data-testid="email">{user.email}</p>
      <img alt={`${user.name}的头像`} src={user.avatar} />
    </div>
  )
}

// getBy: 元素必须存在，不存在则报错
// 适用于：元素应该在 DOM 中渲染出来
test('渲染用户信息', async () => {
  render(<UserProfile userId="1" />)

  // 1. 优先用 getByRole（最接近用户感知）
  const heading = screen.getByRole('heading', { name: /用户A/i })
  expect(heading).toBeInTheDocument()

  // 2. 其次 getByLabelText（表单元素）
  const input = screen.getByLabelText(/用户名/i)

  // 3. 再 getByPlaceholderText
  const field = screen.getByPlaceholderText(/请输入邮箱/i)

  // 4. getByText（普通文本）
  const text = screen.getByText(/加载中/i)

  // 5. getByTestId（兜底方案，其他方式都不适用时）
  const email = screen.getByTestId('email')
  expect(email).toHaveTextContent('user@example.com')
})

// queryBy: 元素可以不存在，返回 null
// 适用于：断言元素不在 DOM 中
test('错误时显示错误提示', () => {
  render(<UserProfile userId="invalid" />)

  // 等待错误提示出现
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('加载失败')

  // 确认用户信息没有渲染
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

// findBy: 异步等待元素出现（返回 Promise）
// 适用于：异步渲染的内容
test('异步加载用户信息', async () => {
  render(<UserProfile userId="1" />)

  // 等待 heading 出现
  const heading = await screen.findByRole('heading', { name: /用户A/i })
  expect(heading).toBeInTheDocument()

  // 也可以用 waitFor 处理更复杂的异步断言
  await waitFor(() => {
    expect(screen.getByText(/user@example.com/i)).toBeInTheDocument()
  })
})
```

## userEvent vs fireEvent

`fireEvent` triggers raw DOM events at a low level, while `userEvent` is closer to real user interaction. The official recommendation is to prefer `userEvent`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

function SearchForm({ onSearch }) {
  const [query, setQuery] = React.useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(query)
      &#125;&#125;
    >
      <input
        type="text"
        placeholder="搜索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit">搜索</button>
    </form>
  )
}

test('用户输入并提交搜索', () => {
  const onSearch = jest.fn()
  render(<SearchForm onSearch={onSearch} />)

  const input = screen.getByPlaceholderText(/搜索/i)
  const button = screen.getByRole('button', { name: /搜索/i })

  // userEvent.type 会逐字符输入，触发每个 keydown/keypress/keyup/input 事件
  userEvent.type(input, 'React Hooks')

  // userEvent.click 模拟完整的鼠标交互
  userEvent.click(button)

  expect(onSearch).toHaveBeenCalledWith('React Hooks')
})

test('键盘导航', () => {
  render(<SearchForm onSearch={jest.fn()} />)

  const input = screen.getByPlaceholderText(/搜索/i)

  // userEvent.tab 模拟 Tab 键切换焦点
  userEvent.tab()
  expect(input).toHaveFocus()

  // 输入后按回车提交
  userEvent.type(input, 'test{enter}')
})
```

## Testing Custom Hooks

For custom Hooks, RTL provides `renderHook`:

```jsx
import { renderHook, act } from '@testing-library/react-hooks'

// 自定义 Hook
function useCounter(initialValue = 0) {
  const [count, setCount] = React.useState(initialValue)
  const increment = () => setCount(c => c + 1)
  const decrement = () => setCount(c => c - 1)
  const reset = () => setCount(initialValue)
  return { count, increment, decrement, reset }
}

test('useCounter 基本功能', () => {
  const { result } = renderHook(() => useCounter(5))

  expect(result.current.count).toBe(5)

  act(() => {
    result.current.increment()
  })
  expect(result.current.count).toBe(6)

  act(() => {
    result.current.decrement()
  })
  expect(result.current.count).toBe(5)

  act(() => {
    result.current.reset()
  })
  expect(result.current.count).toBe(5)
})
```

## Testing Async Requests

Many real-world scenarios involve async requests and need to be paired with MSW (Mock Service Worker) or a Jest mock:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// 被测组件
function UserList() {
  const [users, setUsers] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div role="status">加载中...</div>
  if (error) return <div role="alert">{error}</div>

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}

// 方案一：jest.mock fetch
test('加载并展示用户列表', async () => {
  const mockUsers = [
    { id: 1, name: '张三' },
    { id: 2, name: '李四' }
  ]

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockUsers)
    })
  )

  render(<UserList />)

  // 初始状态是加载中
  expect(screen.getByRole('status')).toHaveTextContent('加载中')

  // 等待数据加载完成
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // 验证用户列表渲染
  expect(screen.getByText('张三')).toBeInTheDocument()
  expect(screen.getByText('李四')).toBeInTheDocument()

  // 清理
  global.fetch.mockRestore()
})

// 方案二：模拟请求失败
test('请求失败时显示错误信息', async () => {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('网络错误'))
  )

  render(<UserList />)

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('网络错误')
  })

  global.fetch.mockRestore()
})
```

## jest.config.js Configuration

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterSetup: ['@testing-library/jest-dom/extend-expect'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '\\.(png|jpg|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx'
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80
    }
  }
}
```

## Summary

- React Testing Library encourages testing user behavior instead of implementation details, so tests stay stable through refactors
- Query priority: getByRole > getByLabelText > getByText > getByTestId
- getBy is for elements that must exist, queryBy asserts an element is absent, findBy waits asynchronously
- userEvent is closer to real user interaction than fireEvent; prefer userEvent
- For async tests use waitFor + findBy, paired with jest.fn() to mock requests
- Test custom Hooks with renderHook + act
