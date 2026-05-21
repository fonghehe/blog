---
title: "Frontend Architecture Patterns Summary"
date: 2019-11-27 15:35:01
tags:
  - Frontend
readingTime: 4
description: "随着前端项目的复杂度不断增长，架构设计变得越来越重要。本文总结了前端开发中常见的架构模式，包括组件架构、状态管理、数据流、目录组织等方面的最佳实践，帮助开发者在项目初期做出更好的技术决策。"
wordCount: 513
---

随着前端项目的复杂度不断增长，架构设计变得越来越重要。本文总结了前端开发中常见的架构模式，包括组件架构、状态管理、数据流、目录组织等方面的最佳实践，帮助开发者在项目初期做出更好的技术决策。

## Component Architecture

### 原子设计（Atomic Design）

原子设计将 UI 组件分为五个层级：

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

### 容器组件与展示组件

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

## State Management Architecture

### 单一数据源

所有应用状态集中在一个 Store 中：

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

### 状态分层

将状态按作用域分层：

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

## Directory Organization Patterns

### 按功能组织（Feature-based）

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

优点：
- 相关代码集中在一起，修改某个功能时不需要在多个目录间跳转
- 功能模块边界清晰，方便做代码分割
- 新人容易理解功能的范围

### 按类型组织（Type-based）

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

优点：
- 目录结构简单，适合小型项目
- 通用组件一目了然

## Data Flow Patterns

### Flux 单向数据流

```
Action → Dispatcher → Store → View
  │                              │
  └──────── 用户交互触发 ─────────┘
```

在 React + Redux 中：

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

### CQRS 模式（命令查询分离）

将读操作和写操作分离：

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

## Modularization and Code Splitting

### 路由级分割

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

### 组件级分割

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

## Error Handling Architecture

### 错误边界

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

### 全局错误处理

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

## Testing Strategy

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

## Summary

- 组件架构采用原子设计或容器/展示组件分离，提高复用性和可维护性
- 状态管理按作用域分层：全局状态用 Redux/Context，页面状态用 URL，组件状态用 useState
- 目录组织推荐按功能（feature-based）划分，相关代码集中管理
- 数据流遵循单向流动，Flux 模式是主流方案
- 代码分割按路由和组件粒度进行，减少首屏加载体积
- 错误处理需要多层防护：错误边界、全局捕获、API 拦截
- 测试策略遵循金字塔模型：单元测试为主，E2E 测试覆盖关键路径
- 没有一成不变的架构，应根据项目规模和团队情况选择合适的模式
