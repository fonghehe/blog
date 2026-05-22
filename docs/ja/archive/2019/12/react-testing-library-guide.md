---
title: "React Testing Libraryテストガイド"
date: 2019-12-09 15:47:43
tags:
  - React
readingTime: 5
description: "今年チームでユニットテストを推進する中で、Enzyme から React Testing Library（RTL）に移行しました。Enzyme は強力ですが、その API は実装の詳細をテストすることを促進します——コンポーネント内部の state や instance メソッドをテストする——そのためリファクタリング時にテストが頻繁に失敗します。React Testing Library の理念はまったく異なります：テスト対象の実装詳細ではなく、ユーザーの行動に焦点を当てます。"
wordCount: 643
---

今年、チームでユニットテストを推進する中で、私たちは Enzyme から React Testing Library（RTL）に移行しました。Enzyme は強力ですが、その API は実装の詳細をテストすることを促進します——コンポーネント内部の state やインスタンスメソッドをテストする——そのためリファクタリング時にテストが頻繁に失敗します。React Testing Library の理念はまったく異なります：**ユーザーの行動をテストするのであって、実装の詳細ではありません**。

## コア哲学

React Testing Library の設計哲学は一言で要約できます：**テストがソフトウェアの使われ方に近ければ近いほど、そのテストはより自信を与えてくれます。**

```jsx
// Enzyme スタイル：実装の詳細をテストする（推奨しない）
import { shallow } from 'enzyme'

test('クリックでカウントが増える', () => {
  const wrapper = shallow(<Counter />)
  expect(wrapper.state('count')).toBe(0)
  wrapper.instance().handleClick()
  expect(wrapper.state('count')).toBe(1)
})

// React Testing Library スタイル：ユーザーの行動をテストする（推奨）
import { render, screen, fireEvent } from '@testing-library/react'

test('クリックでカウントが増える', () => {
  render(<Counter />)
  const button = screen.getByRole('button', { name: /カウント/i })
  expect(button).toHaveTextContent('カウント: 0')

  fireEvent.click(button)
  expect(button).toHaveTextContent('カウント: 1')
})
```

## クエリ優先度：getBy / queryBy / findBy

RTL は3種類のクエリメソッドを提供しており、それぞれに適したシナリオがあります。公式が推奨する優先順位は次のとおりです：

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

  if (error) return <div role="alert">読み込み失敗</div>
  if (!user) return <div>読み込み中...</div>

  return (
    <div>
      <h1>{user.name}</h1>
      <p data-testid="email">{user.email}</p>
      <img alt={`${user.name}のアバター`} src={user.avatar} />
    </div>
  )
}

// getBy: 要素が存在する必要があり、存在しない場合はエラー
// 適用：要素が DOM にレンダリングされているべき場合
test('ユーザー情報が表示される', async () => {
  render(<UserProfile userId="1" />)

  // 1. 優先的に getByRole を使用（ユーザーの知覚に最も近い）
  const heading = screen.getByRole('heading', { name: /ユーザーA/i })
  expect(heading).toBeInTheDocument()

  // 2. 次に getByLabelText（フォーム要素）
  const input = screen.getByLabelText(/ユーザー名/i)

  // 3. さらに getByPlaceholderText
  const field = screen.getByPlaceholderText(/メールアドレスを入力/i)

  // 4. getByText（通常のテキスト）
  const text = screen.getByText(/読み込み中/i)

  // 5. getByTestId（最終手段、他の方法が適用できない場合）
  const email = screen.getByTestId('email')
  expect(email).toHaveTextContent('user@example.com')
})

// queryBy: 要素は存在しなくてもよく、ない場合は null を返す
// 適用：要素が DOM にないことをアサートする場合
test('エラー時にエラーメッセージが表示される', () => {
  render(<UserProfile userId="invalid" />)

  // エラーメッセージの表示を確認
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('読み込み失敗')

  // ユーザー情報が表示されていないことを確認
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

// findBy: 要素が現れるのを非同期的に待つ（Promise を返す）
// 適用：非同期にレンダリングされるコンテンツ
test('非同期でユーザー情報を読み込む', async () => {
  render(<UserProfile userId="1" />)

  // heading が現れるのを待つ
  const heading = await screen.findByRole('heading', { name: /ユーザーA/i })
  expect(heading).toBeInTheDocument()

  // より複雑な非同期アサーションには waitFor も使用可能
  await waitFor(() => {
    expect(screen.getByText(/user@example.com/i)).toBeInTheDocument()
  })
})
```

## userEvent vs fireEvent

`fireEvent` は低レベルの DOM イベント発火であり、`userEvent` は実際のユーザー操作により近いものです。公式では優先的に `userEvent` を使用することを推奨しています：

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
        placeholder="検索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit">検索</button>
    </form>
  )
}

test('ユーザーが入力して検索を実行する', () => {
  const onSearch = jest.fn()
  render(<SearchForm onSearch={onSearch} />)

  const input = screen.getByPlaceholderText(/検索/i)
  const button = screen.getByRole('button', { name: /検索/i })

  // userEvent.type は1文字ずつ入力し、各 keydown/keypress/keyup/input イベントを発火
  userEvent.type(input, 'React Hooks')

  // userEvent.click は完全なマウスインタラクションをシミュレート
  userEvent.click(button)

  expect(onSearch).toHaveBeenCalledWith('React Hooks')
})

test('キーボードナビゲーション', () => {
  render(<SearchForm onSearch={jest.fn()} />)

  const input = screen.getByPlaceholderText(/検索/i)

  // userEvent.tab は Tab キーによるフォーカス移動をシミュレート
  userEvent.tab()
  expect(input).toHaveFocus()

  // 入力後に Enter キーで送信
  userEvent.type(input, 'test{enter}')
})
```

## カスタムHookのテスト

カスタムフックについては、RTL が `renderHook` を提供しています：

```jsx
import { renderHook, act } from '@testing-library/react-hooks'

// カスタムフック
function useCounter(initialValue = 0) {
  const [count, setCount] = React.useState(initialValue)
  const increment = () => setCount(c => c + 1)
  const decrement = () => setCount(c => c - 1)
  const reset = () => setCount(initialValue)
  return { count, increment, decrement, reset }
}

test('useCounter の基本機能', () => {
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

## 非同期リクエストのテスト

実際のプロジェクトでは非同期リクエストのシナリオが多く、MSW（Mock Service Worker）や Jest のモックと組み合わせる必要があります：

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// テスト対象コンポーネント
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

  if (loading) return <div role="status">読み込み中...</div>
  if (error) return <div role="alert">{error}</div>

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}

// 方法1：jest.mock で fetch をモック
test('ユーザーリストを読み込んで表示する', async () => {
  const mockUsers = [
    { id: 1, name: '田中太郎' },
    { id: 2, name: '鈴木花子' }
  ]

  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve(mockUsers)
    })
  )

  render(<UserList />)

  // 初期状態は読み込み中
  expect(screen.getByRole('status')).toHaveTextContent('読み込み中')

  // データ読み込み完了を待つ
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // ユーザーリストの表示を確認
  expect(screen.getByText('田中太郎')).toBeInTheDocument()
  expect(screen.getByText('鈴木花子')).toBeInTheDocument()

  // クリーンアップ
  global.fetch.mockRestore()
})

// 方法2：リクエスト失敗のシミュレート
test('リクエスト失敗時にエラーメッセージが表示される', async () => {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('ネットワークエラー'))
  )

  render(<UserList />)

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('ネットワークエラー')
  })

  global.fetch.mockRestore()
})
```

## jest.config.js の設定

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

## まとめ

- React Testing Library は実装の詳細ではなくユーザーの行動をテストすることを推奨し、リファクタリング時にもテストが安定します
- クエリの優先順位：getByRole > getByLabelText > getByText > getByTestId
- getBy は要素が必須の場合、queryBy は要素が存在しないことのアサート、findBy は非同期待機に使用
- userEvent は fireEvent よりも実際のユーザー操作に近いため、優先的に使用します
- 非同期テストは waitFor + findBy を使用し、jest.fn() でリクエストをモック
- カスタムフックは renderHook + act でテスト
