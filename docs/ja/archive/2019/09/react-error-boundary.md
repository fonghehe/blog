---
title: "React Error Boundary実践"
date: 2019-09-16 10:46:28
tags:
  - React
readingTime: 6
description: "本番環境では、1つのコンポーネントのJavaScriptエラーがアプリ全体をクラッシュさせてはならない。React 16で導入されたError Boundaryの仕組みを使えば、コンポーネントツリー内のエラーを適切に捕捉・処理し、白画面ではなくフォールバックUIを表示できる。本記事ではError Boundaryの原理・使い方・ベストプラクティスを深掘りする。"
wordCount: 881
---

本番環境では、1つのコンポーネントで起きた JavaScript エラーがアプリ全体をクラッシュさせてはならない。React 16 で導入された Error Boundary の仕組みを使えば、コンポーネントツリー内のエラーを適切に捕捉・処理し、白画面ではなくフォールバック UI を表示できる。本記事では Error Boundary の原理・使い方・ベストプラクティスを深掘りする。

## Error Boundaryとは

Error Boundary は React コンポーネントであり、配下のコンポーネントツリーのどこかで発生した JavaScript エラーを捕捉し、エラーを記録するとともにフォールバック UI を表示する。

Error Boundary が捕捉できるエラー：
- レンダリング中のエラー
- ライフサイクルメソッド内のエラー
- コンストラクタ内のエラー

Error Boundary が捕捉できないエラー：
- イベントハンドラ内のエラー（レンダリング中に発生しないため）
- 非同期コード（setTimeout、requestAnimationFrame）
- サーバーサイドレンダリング
- Error Boundary 自身のエラー

## 基本実装

```jsx
{% raw %}
import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  // エラーから新しいstateを導出
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // エラー情報を記録
  componentDidCatch(error, errorInfo) {
    // エラー送信
    this.reportError(error, errorInfo);
    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reportError(error, errorInfo) {
    // 上报到错误监控平台
    console.error('コンポーネントエラー:', error);
    console.error('コンポーネントスタック:', errorInfo.componentStack);

    // 実際のプロジェクトではSentryなどを連携可能
    // Sentry.captureException(error, {
    //   extra: { componentStack: errorInfo.componentStack },
    // });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // カスタムfallbackまたはデフォルトUIを使用
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          retry: this.handleRetry,
        });
      }

      return (
        <div className="error-boundary">
          <h2>エラーが発生しました</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>再試行</button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>
              <summary>エラー詳細</summary>
              {this.state.error?.stack}
              {this.state.errorInfo?.componentStack}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
{% endraw %}
```

## 使い方

### 基本的な使い方

```jsx
import ErrorBoundary from './ErrorBoundary';
import Dashboard from './Dashboard';

function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
```

### 階層化された Error Boundary

```jsx
function App() {
  return (
    <ErrorBoundary fallback={({ retry }) => (
      <div>
        <h1>アプリケーションでエラーが発生しました</h1>
        <button onClick={retry}>ページを更新</button>
      </div>
    )}>
      <Header />

      <ErrorBoundary fallback={({ retry }) => (
        <div>サイドバーの読み込みに失敗しました <button onClick={retry}>再試行</button></div>
      )}>
        <Sidebar />
      </ErrorBoundary>

      <ErrorBoundary fallback={({ retry }) => (
        <div>コンテンツエリアの読み込みに失敗しました <button onClick={retry}>再試行</button></div>
      )}>
        <MainContent />
      </ErrorBoundary>

      <Footer />
    </ErrorBoundary>
  );
}
```

外側の Error Boundary がアプリ全体の未捕捉エラーを兜底（フォールバック）し、内側の Error Boundary が独立した機能モジュールを保護する。これにより、あるモジュールでエラーが起きても他の部分はそのまま動作し続ける。

### React.lazy との併用

```jsx
import React, { Suspense, lazy } from 'react';
import ErrorBoundary from './ErrorBoundary';

const LazyDashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <ErrorBoundary fallback={({ retry }) => (
      <div>
        <p>ページの読み込みに失敗しました</p>
        <button onClick={retry}>再読み込み</button>
      </div>
    )}>
      <Suspense fallback={<div>読み込み中...</div>}>
        <LazyDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## イベントハンドラーのエラー処理

Error Boundaryはイベントハンドラ内のエラーを捕捉できないため、手動でtry/catchする必要がある：

```jsx
import React, { Component } from 'react';

class DataForm extends Component {
  state = { error: null };

  handleSubmit = async (e) => {
    e.preventDefault();

    // イベントハンドラーは手動でエラー処理が必要
    try {
      this.setState({ error: null });
      await api.submitData(this.state.formData);
      // 送信成功
    } catch (error) {
      // stateを更新してエラーを表示
      this.setState({ error: error.message });
      // throwしてError Boundaryにキャッチさせることも可能
      // throw error;
    }
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        {this.state.error && (
          <div className="error-message">{this.state.error}</div>
        )}
        <button type="submit">送信</button>
      </form>
    );
  }
}
```

## 関数コンポーネント + Hooks のエラー処理

Error Boundary はクラスコンポーネントでなければならない（`getDerivedStateFromError` と `componentDidCatch` が必要なため）が、イベントエラーを扱う Hook を自作することはできる：

```jsx
import { useState, useCallback } from 'react';

function useErrorHandler() {
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    setError(err);
    // 同時にthrowしてError Boundaryでもキャッチできるようにする
    // setTimeoutでstateが更新済みであることを保証
    setTimeout(() => {
      throw err;
    }, 0);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { error, handleError, clearError, setError };
}

// 使用例
function UserProfile({ userId }) {
  const { error, handleError } = useErrorHandler();

  const handleDelete = async () => {
    try {
      await api.deleteUser(userId);
    } catch (err) {
      handleError(err);
    }
  };

  if (error) {
    return <div className="error">操作に失敗しました: {error.message}</div>;
  }

  return (
    <div>
      <button onClick={handleDelete}>削除用户</button>
    </div>
  );
}
```

## プロダクション対応のError Boundary

```jsx
import React, { Component } from 'react';
import PropTypes from 'prop-types';

class ErrorBoundary extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    fallback: PropTypes.func,
    onError: PropTypes.func,
    maxRetries: PropTypes.number,
  };

  static defaultProps = {
    maxRetries: 3,
  };

  state = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // エラー監視への送信
    this.reportToErrorService(error, errorInfo);
  }

  reportToErrorService(error, errorInfo) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
    };

    // エラー監視サービスに送信
    if (typeof fetch === 'function') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {
        // 送信失敗は無視
      });
    }

    // 外部から渡されたコールバックも呼び出す
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { maxRetries } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(`${maxRetries}回再試行済み、これ以上再試行しない`);
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { children, fallback, maxRetries } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback({
          error,
          errorInfo,
          retry: this.handleRetry,
          reload: this.handleReload,
          retryCount,
          canRetry: retryCount < maxRetries,
        });
      }

      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-content">
            <h2>ページで問題が発生しました</h2>
            <p className="error-message">
              {error?.message || '不明なエラー'}
            </p>

            <div className="error-actions">
              {retryCount < maxRetries ? (
                <button
                  onClick={this.handleRetry}
                  className="btn btn-primary"
                >
                  再試行 ({retryCount}/{maxRetries})
                </button>
              ) : (
                <p className="text-muted">再試行回数の上限に達しました</p>
              )}

              <button
                onClick={this.handleReload}
                className="btn btn-secondary"
              >
                刷新页面
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>技術詳細（開発環境のみ表示）</summary>
                <pre>{error?.stack}</pre>
                <pre>{errorInfo?.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
```

## まとめ

- Error Boundary は React コンポーネントで、配下コンポーネントツリーのレンダリングエラーを捕捉してフォールバック UI を表示する
- 実装必須のライフサイクルメソッドは `getDerivedStateFromError`（state の更新）と `componentDidCatch`（エラーの記録・上报）の2つだ
- Error Boundary はイベントハンドラ・非同期コード・サーバーサイドレンダリング内のエラーを捕捉できない
- 階層化された Error Boundary でエラーを分離し、あるモジュールでエラーが起きても他のモジュールに影響しないようにする
- イベントハンドラ内のエラーは手動で try/catch するか、自作 Hook で間接的にスローする
- 本番環境ではエラー情報を監視プラットフォーム（Sentryなど）に送信する必要がある
- 無限リトライループを防ぐため、リトライ回数の上限を設けることを推奨する
