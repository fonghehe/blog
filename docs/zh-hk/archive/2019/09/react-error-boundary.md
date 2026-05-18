---
title: "React Error Boundary 錯誤邊界實踐"
date: 2019-09-16 10:46:28
tags:
  - React
readingTime: 5
description: "在生產環境中，一個組件的 JavaScript 錯誤不應該導致整個應用崩潰。React 16 引入的 Error Boundary 機制讓我們可以優雅地捕獲和處理組件樹中的錯誤，展示降級 UI 而非白屏。本文將深入講解 Error Boundary 的原理、用法和最佳實踐。"
---

在生產環境中，一個組件的 JavaScript 錯誤不應該導致整個應用崩潰。React 16 引入的 Error Boundary 機制讓我們可以優雅地捕獲和處理組件樹中的錯誤，展示降級 UI 而非白屏。本文將深入講解 Error Boundary 的原理、用法和最佳實踐。

## 什麼是 Error Boundary

Error Boundary 是 React 組件，用於捕獲其子組件樹中任何位置的 JavaScript 錯誤，記錄錯誤並展示降級 UI。

Error Boundary 可以捕獲的錯誤：
- 渲染期間的錯誤
- 生命週期方法中的錯誤
- 構造函數中的錯誤

Error Boundary 不能捕獲的錯誤：
- 事件處理函數中的錯誤（因為沒有在渲染期間發生）
- 異步代碼（setTimeout、requestAnimationFrame）
- 服務端渲染
- Error Boundary 自身的錯誤

## 基礎實現

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

  // 從錯誤中派生出新的 state
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // 記錄錯誤信息
  componentDidCatch(error, errorInfo) {
    // 錯誤上報
    this.reportError(error, errorInfo);
    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reportError(error, errorInfo) {
    // 上報到錯誤監控平台
    console.error('組件錯誤:', error);
    console.error('組件堆棧:', errorInfo.componentStack);

    // 實際項目中可以接入 Sentry 等
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
      // 使用自定義 fallback 或默認 UI
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          retry: this.handleRetry,
        });
      }

      return (
        <div className="error-boundary">
          <h2>出錯了</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>重試</button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>
              <summary>錯誤詳情</summary>
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

## 使用方式

### 基礎用法

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

### 多級 Error Boundary

```jsx
function App() {
  return (
    <ErrorBoundary fallback={({ retry }) => (
      <div>
        <h1>應用發生錯誤</h1>
        <button onClick={retry}>刷新頁面</button>
      </div>
    )}>
      <Header />

      <ErrorBoundary fallback={({ retry }) => (
        <div>側邊欄加載失敗 <button onClick={retry}>重試</button></div>
      )}>
        <Sidebar />
      </ErrorBoundary>

      <ErrorBoundary fallback={({ retry }) => (
        <div>內容區域加載失敗 <button onClick={retry}>重試</button></div>
      )}>
        <MainContent />
      </ErrorBoundary>

      <Footer />
    </ErrorBoundary>
  );
}
```

外層 Error Boundary 兜底整個應用的未捕獲錯誤，內層 Error Boundary 保護獨立的功能模塊。這樣某個模塊出錯時，其他部分仍然可以正常工作。

### 配合 React.lazy 使用

```jsx
import React, { Suspense, lazy } from 'react';
import ErrorBoundary from './ErrorBoundary';

const LazyDashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <ErrorBoundary fallback={({ retry }) => (
      <div>
        <p>頁面加載失敗</p>
        <button onClick={retry}>重新加載</button>
      </div>
    )}>
      <Suspense fallback={<div>加載中...</div>}>
        <LazyDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## 處理事件處理器中的錯誤

Error Boundary 不能捕獲事件處理器中的錯誤，需要手動 try/catch：

```jsx
import React, { Component } from 'react';

class DataForm extends Component {
  state = { error: null };

  handleSubmit = async (e) => {
    e.preventDefault();

    // 事件處理器需要手動處理錯誤
    try {
      this.setState({ error: null });
      await api.submitData(this.state.formData);
      // 提交成功
    } catch (error) {
      // 更新 state 展示錯誤
      this.setState({ error: error.message });
      // 也可以拋出讓 Error Boundary 捕獲
      // throw error;
    }
  };

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        {this.state.error && (
          <div className="error-message">{this.state.error}</div>
        )}
        <button type="submit">提交</button>
      </form>
    );
  }
}
```

## 函數組件 + Hooks 的錯誤處理

雖然 Error Boundary 必須是類組件（因為需要 `getDerivedStateFromError` 和 `componentDidCatch`），但我們可以封裝一個 Hook 處理事件錯誤：

```jsx
import { useState, useCallback } from 'react';

function useErrorHandler() {
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    setError(err);
    // 同時拋出讓 Error Boundary 能夠捕獲
    // 使用 setTimeout 確保 state 已更新
    setTimeout(() => {
      throw err;
    }, 0);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { error, handleError, clearError, setError };
}

// 使用
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
    return <div className="error">操作失敗: {error.message}</div>;
  }

  return (
    <div>
      <button onClick={handleDelete}>刪除用户</button>
    </div>
  );
}
```

## 完整的生產級 Error Boundary

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

    // 錯誤監控上報
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

    // 發送到錯誤監控服務
    if (typeof fetch === 'function') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {
        // 上報失敗不處理
      });
    }

    // 也調用外部傳入的回調
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { maxRetries } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(`已重試 ${maxRetries} 次，不再重試`);
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
            <h2>頁面出了點問題</h2>
            <p className="error-message">
              {error?.message || '未知錯誤'}
            </p>

            <div className="error-actions">
              {retryCount < maxRetries ? (
                <button
                  onClick={this.handleRetry}
                  className="btn btn-primary"
                >
                  重試 ({retryCount}/{maxRetries})
                </button>
              ) : (
                <p className="text-muted">重試次數已用完</p>
              )}

              <button
                onClick={this.handleReload}
                className="btn btn-secondary"
              >
                刷新頁面
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>技術詳情（僅開發環境可見）</summary>
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

## 小結

- Error Boundary 是 React 組件，用於捕獲子組件樹中的渲染錯誤並展示降級 UI
- 必須實現 `getDerivedStateFromError`（更新 state）和 `componentDidCatch`（記錄/上報錯誤）兩個生命週期方法
- Error Boundary 不能捕獲事件處理器、異步代碼和服務端渲染中的錯誤
- 使用多級 Error Boundary 實現錯誤隔離，某個模塊出錯不影響其他模塊
- 事件處理器中的錯誤需要手動 try/catch，或使用自定義 Hook 間接拋出
- 生產環境需要將錯誤信息上報到監控平台（如 Sentry）
- 建議設置重試次數限制，防止無限重試循環
