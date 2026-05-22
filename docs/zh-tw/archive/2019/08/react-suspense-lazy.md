---
title: "React.lazy + Suspense 程式碼分割實踐"
date: 2019-08-05 11:29:50
tags:
  - React
readingTime: 5
description: "隨著單頁應用規模不斷膨脹，首屏載入的 JS bundle 體積越來越大。React 16.6 引入了 `React.lazy` 和 `Suspense`，讓我們可以在不引入額外第三方庫（如 react-loadable）的情況下實現程式碼分割。本文從實戰角度出發，詳細講解如何在專案中落地這兩個 API。"
wordCount: 999
---

隨著單頁應用規模不斷膨脹，首屏載入的 JS bundle 體積越來越大。React 16.6 引入了 `React.lazy` 和 `Suspense`，讓我們可以在不引入額外第三方庫（如 react-loadable）的情況下實現程式碼分割。本文從實戰角度出發，詳細講解如何在專案中落地這兩個 API。

## 為什麼需要程式碼分割

在一個典型的 React SPA 中，所有路由頁面的程式碼最終會被打包成一個巨大的 JS 檔案。使用者開啟首頁時，需要下載並解析整個 bundle，包括他根本不會訪問的頁面程式碼。這造成了兩個問題：

1. **首次載入時間過長** — 使用者需要等待整個應用下載完成才能看到內容
2. **浪費頻寬** — 使用者可能隻訪問了 20% 的頁面，卻下載了 100% 的程式碼

程式碼分割的核心思想：將程式碼按路由或功能拆分成多個 chunk，按需載入。

## React.lazy 基礎用法

`React.lazy` 接受一個函式，該函式需要動態呼叫 `import()`，返回一個 Promise。它會自動解析為一個可以渲染的 React 元件。

```jsx
import React, { Suspense } from 'react';

// 使用 React.lazy 動態匯入元件
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

Webpack 在構建時會識別 `import()` 語法，自動將這些模組拆分成獨立的 chunk 檔案。

## Suspense 的 fallback 機製

`Suspense` 元件用於在懶載入元件還未就緒時展示一個 fallback UI。有幾個關鍵點需要注意：

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
    <p>頁面載入中...</p>
    <ProgressBar />
  </div>
}>
  <LazyComponent />
</Suspense>
```

### 多個 Suspense 邊界可以巢狀

```jsx
function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Header />
      <Suspense fallback={<ContentSkeleton />}>
        <MainContent />
      </Suspense>
      <Suspense fallback={<div>載入評論...</div>}>
        <Comments />
      </Suspense>
    </Suspense>
  );
}
```

外層 Suspense 捕獲整個頁面級別的載入狀態，內層 Suspense 處理區域性元件的載入。當內層的懶載入元件正在載入時，內層 fallback 生效，外層元件不受影響。

## 路由級別程式碼分割

這是最常見的程式碼分割場景，按路由拆分：

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

### 自定義 webpack chunk 名稱

預設的 chunk 名稱是一串數字，除錯時不夠直觀。可以通過 magic comment 指定：

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

這樣打包後會生成 `home.chunk.js`、`settings.chunk.js`，方便排查問題。

## 元件級別程式碼分割

除了路由級別，某些重量級元件也可以按需載入。比如一個圖表庫非常大，隻有使用者展開某個面板時才需要：

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
      <h1>儀表盤</h1>
      <button onClick={() => setShowChart(true)}>
        顯示圖表
      </button>

      {showChart && (
        <Suspense fallback={<div>圖表載入中...</div>}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

## 配合 Error Boundary 處理載入失敗

網路請求可能失敗，chunk 檔案可能載入失敗。我們需要一個錯誤邊界來捕獲這些異常：

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
    console.error('元件載入失敗:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>頁面載入失敗</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>重試</button>
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

## 帶預載入的路由方案

使用者 hover 到連結時就開始預載入，點選時元件已經就緒，體驗更好：

```jsx
import React, { Suspense, lazy, useState } from 'react';

// 建立一個支援預載入的 lazy 包裝函式
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
        // 滑鼠懸停時預載入
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
          儀表盤
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

## 與 React.lazy 配合的 Webpack 設定

為了讓程式碼分割更高效，建議在 Webpack 中配置 `splitChunks`：

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

這樣 vendor（react、react-dom 等）會被提取到單獨的 chunk，並利用瀏覽器快取。

## 驗證分割效果

構建完成後，可以使用 source-map-explorer 或直接檢視構建產物：

```bash
# 使用 source-map-explorer 分析
npx source-map-explorer build/static/js/*.js

# 或使用 webpack-bundle-analyzer
npx webpack-bundle-analyzer build/static/js/*.js
```

在 Chrome DevTools 的 Network 面板中，切換路由時應該能看到新的 chunk 檔案被按需載入。

## 已知限製

1. **SSR 不支援** — `React.lazy` 不支援服務端渲染，SSR 場景需要使用 `@loadable/component`
2. **巢狀 lazy 不生效** — 不能在 lazy 元件內部再巢狀 lazy 並期望 Suspense 捕獲
3. **錯誤處理需要額外程式碼** — Suspense 本身不處理載入錯誤，必須配合 Error Boundary

## 小結

- `React.lazy` + `Suspense` 是 React 官方提供的程式碼分割方案，簡單且無需額外依賴
- 路由級別和元件級別都可以做程式碼分割，推薦從路由級別開始
- 必須配合 Error Boundary 處理 chunk 載入失敗的場景
- 可以通過 `preload` 技巧在使用者 hover 時提前載入，提升體驗
- SSR 專案暫不適用 React.lazy，需使用 `@loadable/component` 等替代方案
- 合理配置 Webpack `splitChunks` 可以將公共依賴提取出來，進一步最佳化載入效能
