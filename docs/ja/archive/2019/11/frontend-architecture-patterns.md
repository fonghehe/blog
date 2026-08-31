---
title: "フロントエンドアーキテクチャパターンまとめ"
date: 2019-11-27 15:35:01
tags:
  - フロントエンド
readingTime: 6
description: "随着前端项目的复杂度不断增长，架构设计变得越来越重要。本文总结了前端开发中常见的架构模式，包括组件架构、状态管理、数据流、目录组织等方面的最佳实践，帮助开发者在项目初期做出更好的技术决策。"
wordCount: 978
---

フロントエンドプロジェクトの複雑さが増すにつれて、アーキテクチャ設計はますます重要になっています。本記事では、コンポーネント設計、状態管理、データフロー、ディレクトリ構成など、フロントエンド開発で一般的なアーキテクチャパターンをまとめ、プロジェクトの初期段階でより良い技術選定を行えるよう支援します。

## コンポーネントアーキテクチャ

### アトミックデザイン（Atomic Design）

アトミックデザインは UI コンポーネントを 5 つの階層に分類します：

```
Atoms（原子） → Molecules（分子） → Organisms（有机体） → Templates（模板） → Pages（页面）
```

```tsx
// Atoms: 最小的 UI 单元
// Button.tsx
function Button({ children, variant = 'primary', ...props }) {
  return (
    <button className={`btn btn--${variant}`} {...props}>
      {children}
    </button>
  );
}

// Input.tsx
function Input({ label, error, ...props }) {
  return (
    <div className="input-group">
      {label && <label>{label}</label>}
      <input className="input" {...props} />
      {error && <span className="error">{error}</span>}
    </div>
  );
}

// Molecules: 由原子组成的小组件
// SearchBox.tsx (Input + Button)
function SearchBox({ onSearch }) {
  const [keyword, setKeyword] = useState('');

  return (
    <div className="search-box">
      <Input
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
        placeholder="搜索..."
      />
      <Button onClick={() => onSearch(keyword)}>搜索</Button>
    </div>
  );
}

// Organisms: 独立的功能区块
// Header.tsx (Logo + Navigation + SearchBox + UserMenu)
function Header() {
  return (
    <header className="header">
      <Logo />
      <Navigation />
      <SearchBox onSearch={handleSearch} />
      <UserMenu />
    </header>
  );
}
```

### コンテナコンポーネントとプレゼンテーショナルコンポーネント

```tsx
// 展示组件：只负责渲染，通过 props 接收数据
// UserList.jsx
function UserList({ users, loading, onEdit, onDelete }) {
  if (loading) return <Spinner />;

  return (
    <table>
      {users.map(user => (
        <tr key={user.id}>
          <td>{user.name}</td>
          <td>
            <button onClick={() => onEdit(user)}>编辑</button>
            <button onClick={() => onDelete(user.id)}>删除</button>
          </td>
        </tr>
      ))}
    </table>
  );
}

// 容器组件：负责数据获取和业务逻辑
// UserListContainer.jsx
function UserListContainer() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers().then(data => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  function handleEdit(user) { /* ... */ }
  function handleDelete(id) { /* ... */ }

  return (
    <UserList
      users={users}
      loading={loading}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
}
```

## 状態管理アーキテクチャ

### 単一のデータソース

すべてのアプリケーション状態を 1 つの Store に集約します：

```js
// Redux 风格
const store = {
  auth: {
    user: null,
    token: null,
    isAuthenticated: false,
  },
  entities: {
    users: { byId: {}, allIds: [] },
    posts: { byId: {}, allIds: [] },
  },
  ui: {
    sidebar: { collapsed: false },
    modal: { visible: false, type: null },
  },
};
```

### 状態の階層化

状態をスコープ（適用範囲）ごとに階層化します：

```
┌─────────────────────────────────────────┐
│           Global State (Redux/Context)    │
│  用户信息、权限、主题、全局配置            │
├─────────────────────────────────────────┤
│           Page State (URL/Local)          │
│  页面级数据、筛选条件、分页状态            │
├─────────────────────────────────────────┤
│           Component State (useState)      │
│  表单输入、展开/折叠、模态框开关          │
├─────────────────────────────────────────┤
│           URL State                       │
│  当前路由、查询参数、锚点                 │
└─────────────────────────────────────────┘
```

```tsx
// 全局状态：用 Redux 或 Context
const globalStore = { user, theme, locale };

// 页面状态：用 URL 或本地 state
const [filters, setFilters] = useState({ page: 1, sort: 'date' });

// 组件状态：用 useState
const [isOpen, setIsOpen] = useState(false);
const [inputValue, setInputValue] = useState('');
```

## ディレクトリ構成パターン

### 機能別の構成（Feature-based）

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.jsx
│   │   │   └── RegisterForm.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── store/
│   │   │   ├── authSlice.js
│   │   │   └── authActions.js
│   │   ├── services/
│   │   │   └── authService.js
│   │   └── index.js
│   ├── users/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   └── index.js
│   └── posts/
│       ├── components/
│       ├── hooks/
│       ├── store/
│       └── index.js
├── shared/
│   ├── components/
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── Table/
│   ├── hooks/
│   │   ├── useDebounce.js
│   │   └── useFetch.js
│   ├── utils/
│   │   ├── format.js
│   │   └── validate.js
│   └── constants/
│       └── index.js
├── App.jsx
└── index.js
```

メリット：
- 関連するコードがまとまっており、特定の機能を修正する際に複数のディレクトリをまたぐ必要がありません
- 機能モジュールの境界が明確で、コード分割がしやすくなります
- 新しいメンバーが機能の範囲を把握しやすくなります

### 種類別の構成（Type-based）

```
src/
├── components/
│   ├── Button/
│   ├── Modal/
│   └── Table/
├── pages/
│   ├── Home/
│   ├── Login/
│   └── Dashboard/
├── hooks/
├── services/
├── store/
├── utils/
└── styles/
```

メリット：
- ディレクトリ構成がシンプルで、小規模なプロジェクトに向いています
- 共通コンポーネントが一目でわかります

## データフローパターン

### Flux 単方向データフロー

```
Action → Dispatcher → Store → View
  │                              │
  └──────── 用户交互触发 ─────────┘
```

React + Redux では次のようになります：

```jsx
// View 触发 Action
function handleClick() {
  dispatch({ type: 'ADD_ITEM', payload: newItem });
}

// Reducer 处理 Action，更新 Store
function itemsReducer(state = [], action) {
  if (action.type === 'ADD_ITEM') {
    return [...state, action.payload];
  }
  return state;
}

// Store 更新后，View 自动重新渲染
function ItemList() {
  const items = useSelector(state => state.items);
  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
}
```

### CQRS パターン（コマンドとクエリの分離）

読み取り操作と書き込み操作を分離します：

```js
// 查询（Query）：获取数据
const queries = {
  getUser: (id) => fetch(`/api/users/${id}`).then(r => r.json()),
  getUserList: (params) => fetch(`/api/users?${qs.stringify(params)}`).then(r => r.json()),
};

// 命令（Command）：修改数据
const commands = {
  createUser: (data) => fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateUser: (id, data) => fetch(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteUser: (id) => fetch(`/api/users/${id}`, { method: 'DELETE' }),
};
```

## モジュール化とコード分割

### ルーティング単位の分割

```jsx
import React, { lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/settings" component={Settings} />
      </Switch>
    </Suspense>
  );
}
```

### コンポーネント単位の分割

```jsx
// 按需加载重型组件
const RichTextEditor = lazy(() => import('./components/RichTextEditor'));
const Chart = lazy(() => import('./components/Chart'));

function ArticleEditor() {
  return (
    <div>
      <Suspense fallback={<textarea />}>
        <RichTextEditor />
      </Suspense>
    </div>
  );
}
```

## エラー処理アーキテクチャ

### エラーバウンダリ

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 上报到监控平台
    Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ErrorPage error={this.state.error} />;
    }
    return this.props.children;
  }
}

// 使用
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### グローバルなエラー処理

```js
// 未捕获的异常
window.onerror = (message, source, lineno, colno, error) => {
  Sentry.captureException(error);
  return true;
};

// 未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});

// API 错误统一拦截
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // 跳转登录页
      router.push('/login');
    }
    return Promise.reject(error);
  }
);
```

## テスト戦略

```
        E2E 测试（少）
       ╱  用户关键路径
      ╱
集成测试（适量）
      ╲  组件交互
       ╲  API 对接
        ╲
    单元测试（多）
    纯函数、工具方法、组件逻辑
```

```tsx
// 单元测试
describe('formatCurrency', () => {
  it('should format number to currency string', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50');
  });
});

// 组件测试
describe('UserCard', () => {
  it('should display user name', () => {
    const { getByText } = render(<UserCard name="张三" />);
    expect(getByText('张三')).toBeTruthy();
  });
});

// E2E 测试
describe('用户登录', () => {
  it('应该成功登录并跳转到首页', () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type('test@example.com');
    cy.get('[data-testid="password"]').type('password123');
    cy.get('[data-testid="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## まとめ

- コンポーネント設計にはアトミックデザインやコンテナ／プレゼンテーショナル分割を採用し、再利用性と保守性を高める
- 状態管理はスコープごとに階層化する：グローバル状態は Redux/Context、ページ状態は URL、コンポーネント状態は useState
- ディレクトリ構成は機能別（feature-based）の分割を推奨し、関連コードをまとめて管理する
- データフローは単方向の流れに従い、Flux パターンが主流のアプローチです
- コード分割はルーティングとコンポーネントの粒度で行い、初期表示の読み込みサイズを削減する
- エラー処理には多層的な防御が必要：エラーバウンダリ、グローバルな捕捉、API のインターセプト
- テスト戦略はテストピラミッドに従う：単体テストを主とし、E2E テストで重要な経路をカバーする
- 一概に決まったアーキテクチャはなく、プロジェクトの規模とチームの状況に応じて適切なパターンを選ぶべきです
