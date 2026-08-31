---
title: "React.lazy + Suspenseによるコード分割実践"
date: 2019-08-05 11:29:50
tags:
  - React
readingTime: 7
description: "シングルページアプリケーションの規模が膨らむにつれ、初期ロード時のJSバンドルサイズはますます大きくなっている。React 16.6で導入された `React.lazy` と `Suspense` を使えば、react-loadableなどのサードパーティライブラリを追加せずにコード分割を実現できる。本記事では実践的な観点から、プロジェクトでこれら2つのAPIを活用する方法を詳しく解説する。"
wordCount: 1597
---

シングルページアプリケーションの規模が膨らむにつれ、初期ロード時のJSバンドルサイズはますます大きくなっている。React 16.6で導入された `React.lazy` と `Suspense` を使えば、react-loadableなどのサードパーティライブラリを追加せずにコード分割を実現できる。本記事では実践的な観点から、プロジェクトでこれら2つのAPIを活用する方法を詳しく解説する。

## コード分割が必要な理由

一般的なReact SPAでは、すべてのルートページのコードが最終的に1つの巨大なJSファイルにバンドルされる。ユーザーがホームページを開く際、アクセスしないページのコードも含めてバンドル全体をダウンロード・パースする必要がある。これにより2つの問題が生じる：

1. **初期ロード時間が長い** — アプリ全体のダウンロードが完了するまでコンテンツが表示されない
2. **帯域幅の無駄** — ユーザーがアクセスするのは20%のページだけなのに、100%のコードをダウンロードする

コード分割の核心アイデア：コードをルートや機能ごとに複数のチャンクに分割し、必要に応じて読み込むこと。

## React.lazyの基本的な使い方

`React.lazy` は関数を受け取り、その関数は動的に `import()` を呼び出してPromiseを返す必要がある。自動的にレンダリング可能なReactコンポーネントとして解決される。

```jsx
import React, { Suspense } from 'react';

// React.lazyでコンポーネントを動的インポート
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

Webpackはビルド時に `import()` 構文を認識し、これらのモジュールを自動的に独立したチャンクファイルに分割する。

## SuspenseのfallbackメカニズM

`Suspense` コンポーネントは、遅延読み込み中のコンポーネントがまだ準備できていない時にフォールバックUIを表示するために使う。いくつか重要なポイントがある：

### fallbackには任意のReact要素を使用可能

```jsx
<Suspense fallback={<Spinner />}>
  <LazyComponent />
</Suspense>

<Suspense fallback={<Skeleton />}>
  <LazyComponent />
</Suspense>

<Suspense fallback={
  <div className="loading-wrapper">
    <p>ページを読み込み中...</p>
    <ProgressBar />
  </div>
}>
  <LazyComponent />
</Suspense>
```

### 複数のSuspense境界をネスト可能

```jsx
function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Header />
      <Suspense fallback={<ContentSkeleton />}>
        <MainContent />
      </Suspense>
      <Suspense fallback={<div>コメントを読み込み中...</div>}>
        <Comments />
      </Suspense>
    </Suspense>
  );
}
```

外側のSuspenseはページ全体のロード状態をキャプチャし、内側のSuspenseは局所的なコンポーネントのロードを処理する。内側の遅延読み込みコンポーネントがロード中の場合、内側のfallbackが発動し、外側のコンポーネントは影響を受けない。

## ルートレベルのコード分割

これは最も一般的なコード分割のシナリオで、ルートごとに分割する：

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

### カスタムwebpackチャンク名

デフォルトのチャンク名は数字の羅列で、デバッグ時に分かりにくい。magic commentで指定できる：

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

これでバンドル後に `home.chunk.js` や `settings.chunk.js` が生成され、問題の特定が容易になる。

## コンポーネントレベルのコード分割

ルートレベルだけでなく、一部の重いコンポーネントもオンデマンドで読み込める。たとえば、大きなチャートライブラリがあり、ユーザーがパネルを展開した時にだけ必要な場合など：

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
      <h1>ダッシュボード</h1>
      <button onClick={() => setShowChart(true)}>
        チャートを表示
      </button>

      {showChart && (
        <Suspense fallback={<div>チャートを読み込み中...</div>}>
          <HeavyChart />
        </Suspense>
      )}
    </div>
  );
}
```

## Error Boundaryを使った読み込み失敗の処理

ネットワークリクエストが失敗したり、チャンクファイルの読み込みに失敗する可能性がある。これらの例外をキャッチするためのエラーバウンダリが必要だ：

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
    console.error('コンポーネントの読み込み失敗:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>ページの読み込みに失敗しました</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>再試行</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使い方
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

## 先読み付きルート方法

ユーザーがリンクにホバーした時点でプリロードを開始し、クリック時にはコンポーネントが既に準備できているため、体験が向上する：

```jsx
import React, { Suspense, lazy, useState } from 'react';

// プリロード対応のlazyラップ関数を作成
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
        // マウスホバー時にプリロード
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
          ダッシュボード
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

## React.lazy向けWebpack設定

コード分割をより効率的にするため、Webpackで `splitChunks` を設定することを推奨する：

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

これでvendor（react、react-domなど）が個別のチャンクに抽出され、ブラウザキャッシュを活用できる。

## 分割効果の検証

ビルド完了後、source-map-explorerを使うか、ビルド成果物を直接確認できる：

```bash
# source-map-explorerで分析
npx source-map-explorer build/static/js/*.js

# またはwebpack-bundle-analyzerを使用
npx webpack-bundle-analyzer build/static/js/*.js
```

Chrome DevToolsのNetworkパネルで、ルート切り替え時に新しいチャンクファイルがオンデマンドで読み込まれるのを確認できるはずだ。

## 既知の制限

1. **SSR非対応** — `React.lazy` はサーバーサイドレンダリングをサポートしていない。SSRの場合は `@loadable/component` を使う必要がある
2. **ネストしたlazyは機能しない** — lazyコンポーネント内でさらにlazyをネストしても、Suspenseでキャッチすることは期待できない
3. **エラー処理には追加コードが必要** — Suspense自体は読み込みエラーを処理しないため、Error Boundaryとの併用が必須

## まとめ

- `React.lazy` + `Suspense` はReact公式のコード分割ソリューションで、シンプルかつ追加依存不要
- ルートレベルとコンポーネントレベルの両方でコード分割が可能だが、まずはルートレベルから始めることを推奨
- チャンクの読み込み失敗に備えて、Error Boundaryとの併用が必須
- `preload` のテクニックでユーザーのホバー時に事前読み込みし、体験を向上できる
- SSRプロジェクトではReact.lazyは使えないため、`@loadable/component` などの代替案が必要
- Webpackの `splitChunks` を適切に設定することで共通依存を抽出でき、ロードパフォーマンスをさらに最適化できる
