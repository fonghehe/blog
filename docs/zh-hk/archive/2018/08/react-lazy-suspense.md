---
title: "React 16.6：lazy/Suspense 初體驗"
date: 2018-08-16 09:53:24
tags:
  - React
readingTime: 2
description: "React 16.6 發佈，帶來了 `React.lazy` 和 `Suspense`，讓組件懶加載變得非常簡單。"
wordCount: 274
---

React 16.6 發佈，帶來了 `React.lazy` 和 `Suspense`，讓組件懶加載變得非常簡單。

## 之前的組件懶加載

16.6 之前，通常用 `react-loadable` 庫：

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

// lazy 接受一個返回動態 import 的函數
const Dashboard = lazy(() => import("./Dashboard"));
const Settings = lazy(() => import("./Settings"));

function App() {
  return (
    // Suspense 指定加載中的 fallback UI
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
```

`lazy` 包裝的組件在第一次渲染時才會加載對應的 JS 文件。

## 路由級別懶加載

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

## Suspense 的加載狀態

```jsx
{% raw %}
// 更好的 Loading 組件
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

## 錯誤邊界配合使用

lazy 組件加載失敗時，需要錯誤邊界捕獲：

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
          <p>組件加載失敗</p>
          <button onClick={() => window.location.reload()}>刷新重試</button>
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

## 當前限製

16.6 版本的 `Suspense` 目前隻支援 `lazy` 加載，其他數據獲取場景（如等待 API 響應）還在開發中（這是 Concurrent Mode 的一部分）。

React 團隊計劃把 Suspense 擴展到數據獲取領域，屆時可以這樣寫：

```jsx
// 未來可能的寫法（目前還不穩定）
function UserList() {
  const users = fetchUsers.read(); // 如果還沒加載完，Suspense 自動處理
  return (
    <ul>
      {users.map((u) => (
        <li>{u.name}</li>
      ))}
    </ul>
  );
}
```

## vs Vue 的異步組件

對比一下 Vue 的懶加載方式：

```javascript
// Vue：路由懶加載
const Dashboard = () => import("./Dashboard.vue");

// Vue：高級異步組件（有 loading 和 error 狀態）
const AsyncComp = () => ({
  component: import("./Dashboard.vue"),
  loading: LoadingComponent,
  error: ErrorComponent,
  delay: 200,
  timeout: 8000,
});

// React：lazy + Suspense（更標準化的 API）
const Dashboard = lazy(() => import("./Dashboard"));
// fallback 通過 Suspense 統一管理，而非在每個組件裏配置
```

React 的 Suspense 設計更"全局化"，loading 狀態可以由父級集中控製。

## 小結

- `React.lazy` 讓組件懶加載隻需一行代碼
- `Suspense` 統一管理 fallback UI，比單獨配置更簡潔
- 配合 `ErrorBoundary` 處理加載失敗
- 目前隻支援 `lazy`，數據獲取的 Suspense 還在規劃中
