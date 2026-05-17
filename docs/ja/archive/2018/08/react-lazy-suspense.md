---
title: "React 16.6：lazy/Suspenseの初体験"
date: 2018-08-16 09:53:24
tags:
  - React
readingTime: 2
description: "React 16.6がリリースされ、`React.lazy`と`Suspense`が追加されました。コンポーネントの遅延ロードが非常にシンプルになりました。"
---

React 16.6がリリースされ、`React.lazy`と`Suspense`が追加されました。コンポーネントの遅延ロードが非常にシンプルになりました。

## 16.6以前のコンポーネント遅延ロード

16.6以前は、通常`react-loadable`ライブラリを使っていました：

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

// lazyは動的importを返す関数を受け取る
const Dashboard = lazy(() => import("./Dashboard"));
const Settings = lazy(() => import("./Settings"));

function App() {
  return (
    // Suspenseはロード中のfallback UIを指定
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  );
}
```

`lazy`でラップされたコンポーネントは、初回レンダリング時に対応するJSファイルを読み込みます。

## ルートレベルの遅延ロード

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

## Suspenseのロード状態

```jsx
{% raw %}
// より良いLoadingコンポーネント
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

// Suspenseはネストできる
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

## エラーバウンダリとの組み合わせ

lazyコンポーネントの読み込みが失敗した場合、エラーバウンダリでキャッチする必要があります：

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
          <p>コンポーネントの読み込みに失敗しました</p>
          <button onClick={() => window.location.reload()}>再試行</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 使用例
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

## 現在の制限

16.6版の`Suspense`は現在`lazy`ロードのみをサポートしています。その他のデータ取得シナリオ（APIレスポンスの待機など）はConcurrent Modeの一部として開発中です。

Reactチームはデータ取得領域にもSuspenseを拡張する予定で、将来的には以下のような書き方が可能になります：

```jsx
// 将来的に可能な書き方（現在はまだ安定していない）
function UserList() {
  const users = fetchUsers.read(); // まだロードされていない場合、Suspenseが自動的に処理
  return (
    <ul>
      {users.map((u) => (
        <li>{u.name}</li>
      ))}
    </ul>
  );
}
```

## Vueの非同期コンポーネントとの比較

Vueの遅延ロード方法との比較：

```javascript
// Vue：ルート遅延ロード
const Dashboard = () => import("./Dashboard.vue");

// Vue：高度な非同期コンポーネント（loadingとerrorの状態あり）
const AsyncComp = () => ({
  component: import("./Dashboard.vue"),
  loading: LoadingComponent,
  error: ErrorComponent,
  delay: 200,
  timeout: 8000,
});

// React：lazy + Suspense（より標準化されたAPI）
const Dashboard = lazy(() => import("./Dashboard"));
// fallbackはSuspenseを通じて一元管理され、各コンポーネントで設定する必要がない
```
