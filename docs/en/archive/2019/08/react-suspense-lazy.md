---
title: "React.lazy + Suspense Code Splitting in Practice"
date: 2019-08-05 11:29:50
tags:
  - React
readingTime: 5
description: "As single-page apps keep growing, the JavaScript bundle downloaded on first paint keeps getting bigger. React 16.6 introduced `React.lazy` and `Suspense`, letting us code-split without pulling in an extra third-party library like react-loadable. Taking a practical angle, this article explains how to put these two APIs to work in a real project."
wordCount: 595
---

As single-page apps keep growing, the JavaScript bundle downloaded on first paint keeps getting bigger. React 16.6 introduced `React.lazy` and `Suspense`, letting us code-split without pulling in an extra third-party library like react-loadable. Taking a practical angle, this article explains how to put these two APIs to work in a real project.

## Why Code Splitting Is Needed

In a typical React SPA, every route's code ends up bundled into one giant JS file. When a user opens the home page, they have to download and parse the entire bundle—including pages they'll never visit. That creates two problems:

1. **Longer initial load** — users wait for the whole app to download before they see anything.
2. **Wasted bandwidth** — a user might visit only 20% of the pages but downloads 100% of the code.

The core idea of code splitting is to break the code into multiple chunks by route or feature, and load them on demand.

## React.lazy Basic Usage

`React.lazy` takes a function that dynamically calls `import()` and returns a Promise. It resolves automatically into a renderable React component.

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

At build time, Webpack recognizes the `import()` syntax and automatically splits these modules into separate chunk files.

## Suspense's fallback Mechanism

The `Suspense` component shows a fallback UI while a lazily loaded component isn't ready yet. A few key points to note:

### The fallback Can Be Any React Element

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

### Multiple Suspense Boundaries Can Be Nested

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

The outer Suspense captures page-level loading state, while the inner Suspense handles local component loading. When an inner lazy component is loading, only the inner fallback shows; the outer component is unaffected.

## Route-Level Code Splitting

This is the most common code-splitting scenario: splitting by route:

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

### Customizing Webpack Chunk Names

By default, chunk names are a string of numbers, which isn't very readable when debugging. You can name them with a magic comment:

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

The build then produces `home.chunk.js` and `settings.chunk.js`, which makes debugging much easier.

## Component-Level Code Splitting

Beyond route level, some heavy components can also be loaded on demand—for example, a large charting library that's only needed when the user expands a certain panel:

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

Network requests can fail, and chunk files can fail to load. We need an error boundary to catch these exceptions:

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

Start preloading when the user hovers a link, so the component is already ready by the time they click—a much smoother experience:

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

To make code splitting more effective, configure `splitChunks` in Webpack:

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

That extracts the vendor code (react, react-dom, etc.) into a separate chunk, which the browser can then cache.

## Verifying Split Results

After building, you can use source-map-explorer or inspect the build output directly:

```bash
# 使用 source-map-explorer 分析
npx source-map-explorer build/static/js/*.js

# 或使用 webpack-bundle-analyzer
npx webpack-bundle-analyzer build/static/js/*.js
```

In the Chrome DevTools Network panel, switching routes should show new chunk files loaded on demand.

## Known Limitations

1. **No SSR support** — `React.lazy` doesn't support server-side rendering; for SSR use `@loadable/component`.
2. **Nested lazy doesn't work** — you can't nest a lazy component inside another lazy component and expect Suspense to catch it.
3. **Error handling needs extra code** — Suspense itself doesn't handle load errors; you must pair it with an Error Boundary.

## Summary

- `React.lazy` + `Suspense` is React's official, dependency-free code-splitting solution—simple to use.
- You can split both by route and by component; start with route-level splitting.
- Always pair it with an Error Boundary to handle failed chunk loads.
- Use the `preload` trick to load early on hover and improve perceived performance.
- React.lazy isn't suitable for SSR projects yet; use an alternative like `@loadable/component`.
- A sensible Webpack `splitChunks` config extracts shared dependencies, further improving load performance.
