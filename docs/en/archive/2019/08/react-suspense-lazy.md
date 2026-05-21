---
title: "React.lazy + Suspense Code Splitting in Practice"
date: 2019-08-05 11:29:50
tags:
  - React
readingTime: 5
description: "随着单页应用规模不断膨胀，首屏加载的 JS bundle 体积越来越大。React 16.6 引入了 `React.lazy` 和 `Suspense`，让我们可以在不引入额外第三方库（如 react-loadable）的情况下实现代码分割。本文从实战角度出发，详细讲解如何在项目中落地这两个 API。"
wordCount: 940
---

随着单页应用规模不断膨胀，首屏加载的 JS bundle 体积越来越大。React 16.6 引入了 `React.lazy` 和 `Suspense`，让我们可以在不引入额外第三方库（如 react-loadable）的情况下实现代码分割。本文从实战角度出发，详细讲解如何在项目中落地这两个 API。

## Why Code Splitting Is Needed

在一个典型的 React SPA 中，所有路由页面的代码最终会被打包成一个巨大的 JS 文件。用户打开首页时，需要下载并解析整个 bundle，包括他根本不会访问的页面代码。这造成了两个问题：

1. **首次加载时间过长** — 用户需要等待整个应用下载完成才能看到内容
2. **浪费带宽** — 用户可能只访问了 20% 的页面，却下载了 100% 的代码

代码分割的核心思想：将代码按路由或功能拆分成多个 chunk，按需加载。

## React.lazy Basic Usage

`React.lazy` 接受一个函数，该函数需要动态调用 `import()`，返回一个 Promise。它会自动解析为一个可以渲染的 React 组件。

```jsx
import React, { Suspense } from 'react';

// 使用 React.lazy 动态导入组件
const HomePage = React.lazy(() => import('./pages/Home'));
const AboutPage = React.lazy(() => import('./pages/About'));
const DashboardPage = React.lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/dashboard" component={DashboardPage} />
        </Switch>
      </Suspense>
    </Router>
  );
}
```

Webpack 在构建时会识别 `import()` 语法，自动将这些模块拆分成独立的 chunk 文件。

## Suspense's fallback Mechanism

`Suspense` 组件用于在懒加载组件还未就绪时展示一个 fallback UI。有几个关键点需要注意：

### fallback 可以是任何 React 元素

```jsx
<Suspense fallback={<Spinner />}>
  <LazyComponent />
</Suspense>

<Suspense fallback={<Skeleton />}>
  <LazyComponent />
</Suspense>

<Suspense fallback={
  <div className="loading-wrapper">
    <p>页面加载中...</p>
    <ProgressBar />
  </div>
}>
  <LazyComponent />
</Suspense>
```

### 多个 Suspense 边界可以嵌套

```jsx
function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Header />
      <Suspense fallback={<ContentSkeleton />}>
        <MainContent />
      </Suspense>
      <Suspense fallback={<div>加载评论...</div>}>
        <Comments />
      </Suspense>
    </Suspense>
  );
}
```

外层 Suspense 捕获整个页面级别的加载状态，内层 Suspense 处理局部组件的加载。当内层的懒加载组件正在加载时，内层 fallback 生效，外层组件不受影响。

## Route-Level Code Splitting

这是最常见的代码分割场景，按路由拆分：

```jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

const routes = [
  { path: '/', component: lazy(() => import('./pages/Home')), exact: true },
  { path: '/users', component: lazy(() => import('./pages/Users')) },
  { path: '/users/:id', component: lazy(() => import('./pages/UserDetail')) },
  { path: '/settings', component: lazy(() => import('./pages/Settings')) },
  { path: '/reports', component: lazy(() => import('./pages/Reports')) },
  { path: '*', component: lazy(() => import('./pages/NotFound')) },
];

function Loading() {
  return (
    <div className="page-loading">
      <div className="spinner" />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Switch>
          {routes.map(({ path, component, exact }) => (
            <Route
              key={path}
              path={path}
              exact={exact}
              component={component}
            />
          ))}
        </Switch>
      </Suspense>
    </Router>
  );
}
```

### 自定义 webpack chunk 名称

默认的 chunk 名称是一串数字，调试时不够直观。可以通过 magic comment 指定：

```jsx
const HomePage = lazy(() => import(
  /* webpackChunkName: "home" */
  './pages/Home'
));

const SettingsPage = lazy(() => import(
  /* webpackChunkName: "settings" */
  './pages/Settings'
));
```

这样打包后会生成 `home.chunk.js`、`settings.chunk.js`，方便排查问题。

## Component-Level Code Splitting

除了路由级别，某些重量级组件也可以按需加载。比如一个图表库非常大，只有用户展开某个面板时才需要：

```jsx
import React, { Suspense, useState } from 'react';

const HeavyChart = lazy(() => import(
  /* webpackChunkName: "heavy-chart" */
  './components/HeavyChart'
));

function Dashboard() {
  const [showChart, setShowChart] = useState(false);

  return (
    <div>
      <h1>仪表盘</h1>
      <button onClick={() => setShowChart(true)}>
        显示图表
      </button>

      {showChart && (
        <Suspense fallback={<div>图表加载中...</div>}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

## Handling Load Failures with Error Boundary

网络请求可能失败，chunk 文件可能加载失败。我们需要一个错误边界来捕获这些异常：

```jsx
import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('组件加载失败:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>页面加载失败</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>重试</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使用方式
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

## Route Solution with Preloading

用户 hover 到链接时就开始预加载，点击时组件已经就绪，体验更好：

```jsx
import React, { Suspense, lazy, useState } from 'react';

// 创建一个支持预加载的 lazy 包装函数
function lazyWithPreload(factory) {
  const Component = lazy(factory);
  Component.preload = factory;
  return Component;
}

const Dashboard = lazyWithPreload(() => import(
  /* webpackChunkName: "dashboard" */
  './pages/Dashboard'
));

function NavLink({ to, children, component: LazyComp }) {
  return (
    <Link
      to={to}
      onMouseEnter={() => {
        // 鼠标悬停时预加载
        if (LazyComp && LazyComp.preload) {
          LazyComp.preload();
        }
      &#125;&#125;
    >
      {children}
    </Link>
  );
}

function App() {
  return (
    <Router>
      <nav>
        <NavLink to="/dashboard" component={Dashboard}>
          仪表盘
        </NavLink>
      </nav>
      <Suspense fallback={<Loading />}>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
        </Switch>
      </Suspense>
    </Router>
  );
}
```

## Webpack Configuration for React.lazy

为了让代码分割更高效，建议在 Webpack 中配置 `splitChunks`：

```js
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

这样 vendor（react、react-dom 等）会被提取到单独的 chunk，并利用浏览器缓存。

## Verifying Split Results

构建完成后，可以使用 source-map-explorer 或直接查看构建产物：

```bash
# 使用 source-map-explorer 分析
npx source-map-explorer build/static/js/*.js

# 或使用 webpack-bundle-analyzer
npx webpack-bundle-analyzer build/static/js/*.js
```

在 Chrome DevTools 的 Network 面板中，切换路由时应该能看到新的 chunk 文件被按需加载。

## Known Limitations

1. **SSR 不支持** — `React.lazy` 不支持服务端渲染，SSR 场景需要使用 `@loadable/component`
2. **嵌套 lazy 不生效** — 不能在 lazy 组件内部再嵌套 lazy 并期望 Suspense 捕获
3. **错误处理需要额外代码** — Suspense 本身不处理加载错误，必须配合 Error Boundary

## Summary

- `React.lazy` + `Suspense` 是 React 官方提供的代码分割方案，简单且无需额外依赖
- 路由级别和组件级别都可以做代码分割，推荐从路由级别开始
- 必须配合 Error Boundary 处理 chunk 加载失败的场景
- 可以通过 `preload` 技巧在用户 hover 时提前加载，提升体验
- SSR 项目暂不适用 React.lazy，需使用 `@loadable/component` 等替代方案
- 合理配置 Webpack `splitChunks` 可以将公共依赖提取出来，进一步优化加载性能
