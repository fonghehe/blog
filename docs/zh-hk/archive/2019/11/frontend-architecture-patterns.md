---
title: "前端架構模式總結"
date: 2019-11-27 15:35:01
tags:
  - 前端
readingTime: 4
description: "隨着前端項目的複雜度不斷增長，架構設計變得越來越重要。本文總結了前端開發中常見的架構模式，包括組件架構、狀態管理、數據流、目錄組織等方面的最佳實踐，幫助開發者在項目初期做出更好的技術決策。"
---

隨着前端項目的複雜度不斷增長，架構設計變得越來越重要。本文總結了前端開發中常見的架構模式，包括組件架構、狀態管理、數據流、目錄組織等方面的最佳實踐，幫助開發者在項目初期做出更好的技術決策。

## 組件架構

### 原子設計（Atomic Design）

原子設計將 UI 組件分為五個層級：

```
Atoms（原子） → Molecules（分子） → Organisms（有機體） → Templates（模板） → Pages（頁面）
```

```tsx
// Atoms: 最小的 UI 單元
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

// Molecules: 由原子組成的小組件
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

// Organisms: 獨立的功能區塊
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

### 容器組件與展示組件

```tsx
// 展示組件：只負責渲染，通過 props 接收數據
// UserList.jsx
function UserList({ users, loading, onEdit, onDelete }) {
  if (loading) return <Spinner />;

  return (
    <table>
      {users.map(user => (
        <tr key={user.id}>
          <td>{user.name}</td>
          <td>
            <button onClick={() => onEdit(user)}>編輯</button>
            <button onClick={() => onDelete(user.id)}>刪除</button>
          </td>
        </tr>
      ))}
    </table>
  );
}

// 容器組件：負責數據獲取和業務邏輯
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

## 狀態管理架構

### 單一數據源

所有應用狀態集中在一個 Store 中：

```js
// Redux 風格
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

### 狀態分層

將狀態按作用域分層：

```
┌─────────────────────────────────────────┐
│           Global State (Redux/Context)    │
│  用户信息、權限、主題、全局配置            │
├─────────────────────────────────────────┤
│           Page State (URL/Local)          │
│  頁面級數據、篩選條件、分頁狀態            │
├─────────────────────────────────────────┤
│           Component State (useState)      │
│  表單輸入、展開/摺疊、模態框開關          │
├─────────────────────────────────────────┤
│           URL State                       │
│  當前路由、查詢參數、錨點                 │
└─────────────────────────────────────────┘
```

```tsx
// 全局狀態：用 Redux 或 Context
const globalStore = { user, theme, locale };

// 頁面狀態：用 URL 或本地 state
const [filters, setFilters] = useState({ page: 1, sort: 'date' });

// 組件狀態：用 useState
const [isOpen, setIsOpen] = useState(false);
const [inputValue, setInputValue] = useState('');
```

## 目錄組織模式

### 按功能組織（Feature-based）

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

優點：
- 相關代碼集中在一起，修改某個功能時不需要在多個目錄間跳轉
- 功能模塊邊界清晰，方便做代碼分割
- 新人容易理解功能的範圍

### 按類型組織（Type-based）

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

優點：
- 目錄結構簡單，適合小型項目
- 通用組件一目瞭然

## 數據流模式

### Flux 單向數據流

```
Action → Dispatcher → Store → View
  │                              │
  └──────── 用户交互觸發 ─────────┘
```

在 React + Redux 中：

```jsx
// View 觸發 Action
function handleClick() {
  dispatch({ type: 'ADD_ITEM', payload: newItem });
}

// Reducer 處理 Action，更新 Store
function itemsReducer(state = [], action) {
  if (action.type === 'ADD_ITEM') {
    return [...state, action.payload];
  }
  return state;
}

// Store 更新後，View 自動重新渲染
function ItemList() {
  const items = useSelector(state => state.items);
  return <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
}
```

### CQRS 模式（命令查詢分離）

將讀操作和寫操作分離：

```js
// 查詢（Query）：獲取數據
const queries = {
  getUser: (id) => fetch(`/api/users/${id}`).then(r => r.json()),
  getUserList: (params) => fetch(`/api/users?${qs.stringify(params)}`).then(r => r.json()),
};

// 命令（Command）：修改數據
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

## 模塊化與代碼分割

### 路由級分割

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

### 組件級分割

```jsx
// 按需加載重型組件
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

## 錯誤處理架構

### 錯誤邊界

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 上報到監控平台
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

### 全局錯誤處理

```js
// 未捕獲的異常
window.onerror = (message, source, lineno, colno, error) => {
  Sentry.captureException(error);
  return true;
};

// 未處理的 Promise 拒絕
window.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(event.reason);
});

// API 錯誤統一攔截
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // 跳轉登錄頁
      router.push('/login');
    }
    return Promise.reject(error);
  }
);
```

## 測試策略

```
        E2E 測試（少）
       ╱  用户關鍵路徑
      ╱
集成測試（適量）
      ╲  組件交互
       ╲  API 對接
        ╲
    單元測試（多）
    純函數、工具方法、組件邏輯
```

```tsx
// 單元測試
describe('formatCurrency', () => {
  it('should format number to currency string', () => {
    expect(formatCurrency(1234.5)).toBe('¥1,234.50');
  });
});

// 組件測試
describe('UserCard', () => {
  it('should display user name', () => {
    const { getByText } = render(<UserCard name="張三" />);
    expect(getByText('張三')).toBeTruthy();
  });
});

// E2E 測試
describe('用户登錄', () => {
  it('應該成功登錄並跳轉到首頁', () => {
    cy.visit('/login');
    cy.get('[data-testid="email"]').type('test@example.com');
    cy.get('[data-testid="password"]').type('password123');
    cy.get('[data-testid="submit"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## 小結

- 組件架構採用原子設計或容器/展示組件分離，提高複用性和可維護性
- 狀態管理按作用域分層：全局狀態用 Redux/Context，頁面狀態用 URL，組件狀態用 useState
- 目錄組織推薦按功能（feature-based）劃分，相關代碼集中管理
- 數據流遵循單向流動，Flux 模式是主流方案
- 代碼分割按路由和組件粒度進行，減少首屏加載體積
- 錯誤處理需要多層防護：錯誤邊界、全局捕獲、API 攔截
- 測試策略遵循金字塔模型：單元測試為主，E2E 測試覆蓋關鍵路徑
- 沒有一成不變的架構，應根據項目規模和團隊情況選擇合適的模式
