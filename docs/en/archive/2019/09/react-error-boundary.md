---
title: "React Error Boundary in Practice"
date: 2019-09-16 10:46:28
tags:
  - React
readingTime: 4
description: "In production, a JavaScript error in one component shouldn't bring down the entire application. The Error Boundary mechanism introduced in React 16 lets us gracefully catch and handle errors anywhere in the component tree, showing a fallback UI instead of a blank white screen. This article takes an in-depth look at how Error Boundaries work, how to use them, and best practices."
wordCount: 334
---

In production, a JavaScript error in one component shouldn't bring down the entire application. The Error Boundary mechanism introduced in React 16 lets us gracefully catch and handle errors anywhere in the component tree, showing a fallback UI instead of a blank white screen. This article takes an in-depth look at how Error Boundaries work, how to use them, and best practices.

## What Is an Error Boundary

An Error Boundary is a React component that catches JavaScript errors anywhere in its child component tree, logs those errors, and displays a fallback UI.

Errors an Error Boundary can catch:
- Errors during rendering
- Errors in lifecycle methods
- Errors in constructors

Errors an Error Boundary cannot catch:
- Errors in event handlers (because they don't happen during rendering)
- Asynchronous code (setTimeout, requestAnimationFrame)
- Server-side rendering
- Errors in the Error Boundary itself

## Basic Implementation

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

  // 从错误中派生出新的 state
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // 记录错误信息
  componentDidCatch(error, errorInfo) {
    // 错误上报
    this.reportError(error, errorInfo);
    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reportError(error, errorInfo) {
    // 上报到错误监控平台
    console.error('组件错误:', error);
    console.error('组件堆栈:', errorInfo.componentStack);

    // 实际项目中可以接入 Sentry 等
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
      // 使用自定义 fallback 或默认 UI
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          retry: this.handleRetry,
        });
      }

      return (
        <div className="error-boundary">
          <h2>出错了</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={this.handleRetry}>重试</button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>
              <summary>错误详情</summary>
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

## Usage

### Basic Usage

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

### Nested Error Boundaries

```jsx
function App() {
  return (
    <ErrorBoundary fallback={({ retry }) => (
      <div>
        <h1>应用发生错误</h1>
        <button onClick={retry}>刷新页面</button>
      </div>
    )}>
      <Header />

      <ErrorBoundary fallback={({ retry }) => (
        <div>侧边栏加载失败 <button onClick={retry}>重试</button></div>
      )}>
        <Sidebar />
      </ErrorBoundary>

      <ErrorBoundary fallback={({ retry }) => (
        <div>内容区域加载失败 <button onClick={retry}>重试</button></div>
      )}>
        <MainContent />
      </ErrorBoundary>

      <Footer />
    </ErrorBoundary>
  );
}
```

The outer Error Boundary catches any uncaught error for the whole app, while the inner ones protect independent feature modules. That way, when one module fails, the rest keeps working.

### Using with React.lazy

```jsx
import React, { Suspense, lazy } from 'react';
import ErrorBoundary from './ErrorBoundary';

const LazyDashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <ErrorBoundary fallback={({ retry }) => (
      <div>
        <p>页面加载失败</p>
        <button onClick={retry}>重新加载</button>
      </div>
    )}>
      <Suspense fallback={<div>加载中...</div>}>
        <LazyDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Handling Errors in Event Handlers

Error Boundaries can't catch errors in event handlers; you need a manual try/catch:

```jsx
import React, { Component } from 'react';

class DataForm extends Component {
  state = { error: null };

  handleSubmit = async (e) => {
    e.preventDefault();

    // 事件处理器需要手动处理错误
    try {
      this.setState({ error: null });
      await api.submitData(this.state.formData);
      // 提交成功
    } catch (error) {
      // 更新 state 展示错误
      this.setState({ error: error.message });
      // 也可以抛出让 Error Boundary 捕获
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

## Function Component + Hooks Error Handling

Although an Error Boundary must be a class component (because it needs `getDerivedStateFromError` and `componentDidCatch`), we can wrap a Hook to handle event errors:

```jsx
import { useState, useCallback } from 'react';

function useErrorHandler() {
  const [error, setError] = useState(null);

  const handleError = useCallback((err) => {
    setError(err);
    // 同时抛出让 Error Boundary 能够捕获
    // 使用 setTimeout 确保 state 已更新
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
    return <div className="error">操作失败: {error.message}</div>;
  }

  return (
    <div>
      <button onClick={handleDelete}>删除用户</button>
    </div>
  );
}
```

## Production-Grade Error Boundary

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

    // 错误监控上报
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

    // 发送到错误监控服务
    if (typeof fetch === 'function') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {
        // 上报失败不处理
      });
    }

    // 也调用外部传入的回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { maxRetries } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn(`已重试 ${maxRetries} 次，不再重试`);
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
            <h2>页面出了点问题</h2>
            <p className="error-message">
              {error?.message || '未知错误'}
            </p>

            <div className="error-actions">
              {retryCount < maxRetries ? (
                <button
                  onClick={this.handleRetry}
                  className="btn btn-primary"
                >
                  重试 ({retryCount}/{maxRetries})
                </button>
              ) : (
                <p className="text-muted">重试次数已用完</p>
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
                <summary>技术详情（仅开发环境可见）</summary>
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

## Summary

- An Error Boundary is a React component that catches rendering errors in its child tree and shows a fallback UI.
- It must implement two lifecycle methods: `getDerivedStateFromError` (to update state) and `componentDidCatch` (to log/report the error).
- Error Boundaries can't catch errors in event handlers, async code, or server-side rendering.
- Use nested Error Boundaries to isolate failures so one module's error doesn't affect others.
- Errors in event handlers need a manual try/catch, or an indirect rethrow via a custom Hook.
- In production, report error info to a monitoring service (such as Sentry).
- It's a good idea to cap the retry count to prevent infinite retry loops.
