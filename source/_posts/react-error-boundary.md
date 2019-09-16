---
title: "React Error Boundary 错误边界实践"
date: 2019-09-16 10:46:28
tags:
  - React
---

在生产环境中，一个组件的 JavaScript 错误不应该导致整个应用崩溃。React 16 引入的 Error Boundary 机制让我们可以优雅地捕获和处理组件树中的错误，展示降级 UI 而非白屏。本文将深入讲解 Error Boundary 的原理、用法和最佳实践。

## 什么是 Error Boundary

Error Boundary 是 React 组件，用于捕获其子组件树中任何位置的 JavaScript 错误，记录错误并展示降级 UI。

Error Boundary 可以捕获的错误：
- 渲染期间的错误
- 生命周期方法中的错误
- 构造函数中的错误

Error Boundary 不能捕获的错误：
- 事件处理函数中的错误（因为没有在渲染期间发生）
- 异步代码（setTimeout、requestAnimationFrame）
- 服务端渲染
- Error Boundary 自身的错误

## 基础实现

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

## 使用方式

### 基础用法

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

### 多级 Error Boundary

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

外层 Error Boundary 兜底整个应用的未捕获错误，内层 Error Boundary 保护独立的功能模块。这样某个模块出错时，其他部分仍然可以正常工作。

### 配合 React.lazy 使用

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

## 处理事件处理器中的错误

Error Boundary 不能捕获事件处理器中的错误，需要手动 try/catch：

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

## 函数组件 + Hooks 的错误处理

虽然 Error Boundary 必须是类组件（因为需要 `getDerivedStateFromError` 和 `componentDidCatch`），但我们可以封装一个 Hook 处理事件错误：

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

## 完整的生产级 Error Boundary

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

## 小结

- Error Boundary 是 React 组件，用于捕获子组件树中的渲染错误并展示降级 UI
- 必须实现 `getDerivedStateFromError`（更新 state）和 `componentDidCatch`（记录/上报错误）两个生命周期方法
- Error Boundary 不能捕获事件处理器、异步代码和服务端渲染中的错误
- 使用多级 Error Boundary 实现错误隔离，某个模块出错不影响其他模块
- 事件处理器中的错误需要手动 try/catch，或使用自定义 Hook 间接抛出
- 生产环境需要将错误信息上报到监控平台（如 Sentry）
- 建议设置重试次数限制，防止无限重试循环
