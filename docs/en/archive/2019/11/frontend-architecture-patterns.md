---
title: "Frontend Architecture Patterns Summary"
date: 2019-11-27 15:35:01
tags:
  - Frontend
readingTime: 4
description: "As front-end projects grow in complexity, architecture design becomes increasingly important. This article summarizes common architectural patterns in front-end development—covering component architecture, state management, data flow, and directory organization—to help you make better technical decisions early in a project."
wordCount: 271
---

As front-end projects grow in complexity, architecture design becomes increasingly important. This article summarizes common architectural patterns in front-end development—covering component architecture, state management, data flow, and directory organization—to help you make better technical decisions early in a project.

## Component Architecture

### Atomic Design

Atomic design divides UI components into five levels:

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

### Container and Presentational Components

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

### Single Source of Truth

All application state lives in a single store:

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

### Layered State

Layered state by scope:

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

### Feature-Based Organization

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

Advantages:
- Related code lives together, so you don't jump between directories to change a feature
- Clear module boundaries make code splitting easy
- Newcomers can quickly grasp the scope of a feature

### Type-Based Organization

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

Advantages:
- Simple structure, suited to small projects
- Shared components are easy to find at a glance

## Data Flow Patterns

### Flux Unidirectional Data Flow

```
Action → Dispatcher → Store → View
  │                              │
  └──────── 用户交互触发 ─────────┘
```

In React + Redux:

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

### CQRS (Command Query Responsibility Segregation)

Separate read operations from write operations:

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

### Route-Level Splitting

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

### Component-Level Splitting

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

### Error Boundaries

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

### Global Error Handling

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

- Use atomic design or container/presentational separation to improve reuse and maintainability
- Layer state by scope: global state with Redux/Context, page state with the URL, component state with useState
- Organize directories by feature so related code stays together
- Keep data flow unidirectional; the Flux pattern is the mainstream approach
- Split code at the route and component level to shrink the initial load
- Defend errors on multiple layers: error boundaries, global capture, and API interception
- Follow the testing pyramid: mostly unit tests, with E2E covering critical paths
- There is no one-size-fits-all architecture; pick a pattern based on project size and team context
