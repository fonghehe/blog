---
title: "React Testing Library 測試指南：實踐方法與治理思路"
date: 2019-12-09 15:47:43
tags:
  - React
readingTime: 3
description: "今年團隊在推動單元測試的過程中，我們從 Enzyme 遷移到了 React Testing Library（RTL）。Enzyme 雖然功能強大，但它的 API 鼓勵測試實現細節——測試組件內部 state、instance 方法——導致重構時測試頻繁掛掉。React Testing Library 的理念完全不同：*"
wordCount: 361
---

今年團隊在推動單元測試的過程中，我們從 Enzyme 遷移到了 React Testing Library（RTL）。Enzyme 雖然功能強大，但它的 API 鼓勵測試實現細節——測試組件內部 state、instance 方法——導致重構時測試頻繁掛掉。React Testing Library 的理念完全不同：**測試用户行為，而不是實現細節**。

## 核心理念

React Testing Library 的設計哲學可以用一句話概括：**你的測試越像軟件的使用方式，它們就越能給你信心。**

```jsx
// Enzyme 風格：測試實現細節（不推薦）
import { shallow } from 'enzyme'

test('點擊按鈕增加計數', () => {
  const wrapper = shallow(<Counter />)
  expect(wrapper.state('count')).toBe(0)
  wrapper.instance().handleClick()
  expect(wrapper.state('count')).toBe(1)
})

// React Testing Library 風格：測試用户行為（推薦）
import { render, screen, fireEvent } from '@testing-library/react'

test('點擊按鈕增加計數', () => {
  render(<Counter />)
  const button = screen.getByRole('button', { name: /計數/i })
  expect(button).toHaveTextContent('計數: 0')

  fireEvent.click(button)
  expect(button).toHaveTextContent('計數: 1')
})
```

## 查詢優先級：getBy / queryBy / findBy

RTL 提供了三類查詢方法，各有適用場景。官方推薦的優先級是：

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

  if (error) return <div role="alert">加載失敗</div>
  if (!user) return <div>加載中...</div>

  return (
    <div>
      <h1>{user.name}</h1>
      <p data-testid="email">{user.email}</p>
      <img alt={`${user.name}的頭像`} src={user.avatar} />
    </div>
  )
}

// getBy: 元素必須存在，不存在則報錯
// 適用於：元素應該在 DOM 中渲染出來
test('渲染用户信息', async () => {
  render(<UserProfile userId="1" />)

  // 1. 優先用 getByRole（最接近用户感知）
  const heading = screen.getByRole('heading', { name: /用户A/i })
  expect(heading).toBeInTheDocument()

  // 2. 其次 getByLabelText（表單元素）
  const input = screen.getByLabelText(/用户名/i)

  // 3. 再 getByPlaceholderText
  const field = screen.getByPlaceholderText(/請輸入郵箱/i)

  // 4. getByText（普通文本）
  const text = screen.getByText(/加載中/i)

  // 5. getByTestId（兜底方案，其他方式都不適用時）
  const email = screen.getByTestId('email')
  expect(email).toHaveTextContent('user@example.com')
})

// queryBy: 元素可以不存在，返回 null
// 適用於：斷言元素不在 DOM 中
test('錯誤時顯示錯誤提示', () => {
  render(<UserProfile userId="invalid" />)

  // 等待錯誤提示出現
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('加載失敗')

  // 確認用户信息沒有渲染
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

// findBy: 異步等待元素出現（返回 Promise）
// 適用於：異步渲染的內容
test('異步加載用户信息', async () => {
  render(<UserProfile userId="1" />)

  // 等待 heading 出現
  const heading = await screen.findByRole('heading', { name: /用户A/i })
  expect(heading).toBeInTheDocument()

  // 也可以用 waitFor 處理更復雜的異步斷言
  await waitFor(() => {
    expect(screen.getByText(/user@example.com/i)).toBeInTheDocument()
  })
})
```

## userEvent vs fireEvent

`fireEvent` 是底層的 DOM 事件觸發，而 `userEvent` 更貼近真實用户交互。官方推薦優先使用 `userEvent`：

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

test('用户輸入並提交搜索', () => {
  const onSearch = jest.fn()
  render(<SearchForm onSearch={onSearch} />)

  const input = screen.getByPlaceholderText(/搜索/i)
  const button = screen.getByRole('button', { name: /搜索/i })

  // userEvent.type 會逐字符輸入，觸發每個 keydown/keypress/keyup/input 事件
  userEvent.type(input, 'React Hooks')

  // userEvent.click 模擬完整的鼠標交互
  userEvent.click(button)

  expect(onSearch).toHaveBeenCalledWith('React Hooks')
})

test('鍵盤導航', () => {
  render(<SearchForm onSearch={jest.fn()} />)

  const input = screen.getByPlaceholderText(/搜索/i)

  // userEvent.tab 模擬 Tab 鍵切換焦點
  userEvent.tab()
  expect(input).toHaveFocus()

  // 輸入後按回車提交
  userEvent.type(input, 'test{enter}')
})
```

## 測試自定義 Hook

對於自定義 Hook，RTL 提供了 `renderHook`：

```jsx
import { renderHook, act } from '@testing-library/react-hooks'

// 自定義 Hook
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

## 測試異步請求

實際項目中大量場景涉及異步請求，需要配合 MSW（Mock Service Worker）或 Jest mock：

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// 被測組件
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

  if (loading) return <div role="status">加載中...</div>
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
test('加載並展示用户列表', async () => {
  const mockUsers = [
    { id: 1, name: '張三' },
    { id: 2, name: '李四' }
  ]

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockUsers)
    })
  )

  render(<UserList />)

  // 初始狀態是加載中
  expect(screen.getByRole('status')).toHaveTextContent('加載中')

  // 等待數據加載完成
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // 驗證用户列表渲染
  expect(screen.getByText('張三')).toBeInTheDocument()
  expect(screen.getByText('李四')).toBeInTheDocument()

  // 清理
  global.fetch.mockRestore()
})

// 方案二：模擬請求失敗
test('請求失敗時顯示錯誤信息', async () => {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('網絡錯誤'))
  )

  render(<UserList />)

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('網絡錯誤')
  })

  global.fetch.mockRestore()
})
```

## jest.config.js 設定

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

## 小結

- React Testing Library 鼓勵測試用户行為而非實現細節，重構時測試更穩定
- 查詢優先級：getByRole > getByLabelText > getByText > getByTestId
- getBy 用於元素必須存在，queryBy 用於斷言元素不存在，findBy 用於異步等待
- userEvent 比 fireEvent 更貼近真實用户交互，優先使用 userEvent
- 異步測試用 waitFor + findBy，配合 jest.fn() mock 請求
- 自定義 Hook 用 renderHook + act 測試
