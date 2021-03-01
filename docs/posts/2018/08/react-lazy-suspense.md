---
title: "React 16.6：lazy/Suspense 初体验"
date: 2018-08-16 09:53:24
tags:
  - React
---

React 16.6 发布，带来了 `React.lazy` 和 `Suspense`，让组件懒加载变得非常简单。

## 之前的组件懒加载

16.6 之前，通常用 `react-loadable` 库：

```javascript
import Loadable from "react-loadable";

const Dashboard = Loadable({
  loader: () => import("./Dashboard"),
  loading: () => <div>Loading...</div>,
});
```

## React.lazy + Suspense

```javascript
import React, { lazy, Suspense } from "react";

// lazy 接受一个返回动态 import 的函数
const Dashboard = lazy(() => import("./Dashboard"));
const Settings = lazy(() => import("./Settings"));

function App() {
  return (
    // Suspense 指定加载中的 fallback UI
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
```

`lazy` 包装的组件在第一次渲染时才会加载对应的 JS 文件。

## 路由级别懒加载

```javascript
import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";

const Home = lazy(() => import("./routes/Home"));
const About = lazy(() => import("./routes/About"));
const Users = lazy(() => import("./routes/Users"));

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="page-loader">Loading...</div>}>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/about" component={About} />
          <Route path="/users" component={Users} />
        </Switch>
      </Suspense>
    </Router>
  );
}
```

## Suspense 的加载状态

```jsx
{% raw %}
// 更好的 Loading 组件
function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <Spinner />
    </div>
  );
}

// Suspense 可以嵌套
function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Header />
      <Suspense fallback={<ContentLoader />}>
        <MainContent />
      </Suspense>
      <Footer />
    </Suspense>
  );
}
{% endraw %}
```

## 错误边界配合使用

lazy 组件加载失败时，需要错误边界捕获：

```javascript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>组件加载失败</p>
          <button onClick={() => window.location.reload()}>刷新重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 使用
function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <LazyComponent />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## 当前限制

16.6 版本的 `Suspense` 目前只支持 `lazy` 加载，其他数据获取场景（如等待 API 响应）还在开发中（这是 Concurrent Mode 的一部分）。

React 团队计划把 Suspense 扩展到数据获取领域，届时可以这样写：

```jsx
// 未来可能的写法（目前还不稳定）
function UserList() {
  const users = fetchUsers.read(); // 如果还没加载完，Suspense 自动处理
  return (
    <ul>
      {users.map((u) => (
        <li>{u.name}</li>
      ))}
    </ul>
  );
}
```

## vs Vue 的异步组件

对比一下 Vue 的懒加载方式：

```javascript
// Vue：路由懒加载
const Dashboard = () => import("./Dashboard.vue");

// Vue：高级异步组件（有 loading 和 error 状态）
const AsyncComp = () => ({
  component: import("./Dashboard.vue"),
  loading: LoadingComponent,
  error: ErrorComponent,
  delay: 200,
  timeout: 8000,
});

// React：lazy + Suspense（更标准化的 API）
const Dashboard = lazy(() => import("./Dashboard"));
// fallback 通过 Suspense 统一管理，而非在每个组件里配置
```

React 的 Suspense 设计更"全局化"，loading 状态可以由父级集中控制。

## 小结

- `React.lazy` 让组件懒加载只需一行代码
- `Suspense` 统一管理 fallback UI，比单独配置更简洁
- 配合 `ErrorBoundary` 处理加载失败
- 目前只支持 `lazy`，数据获取的 Suspense 还在规划中
