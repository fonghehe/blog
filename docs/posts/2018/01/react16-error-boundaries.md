---
title: "React 16 错误边界：告别白屏崩溃"
date: 2018-01-09 11:00:56
tags:
  - React
---

React 16 在 2017 年 9 月发布，带来了 Fiber 架构重写，但对日常开发影响最直接的特性之一是错误边界（Error Boundaries）。这个特性解决了 React 应用长期以来的一个痛点：一个组件抛出未捕获的异常，整个应用树就白屏了。

## React 15 的问题

在 React 15 及更早版本，组件渲染期间的错误会让 React 进入不可预知的状态，有时渲染损坏的 UI，有时什么都不显示。React 官方后来把这个行为改成了明确的"卸载整个组件树"——但这意味着用户看到的是一片空白。

```javascript
// 这在 React 15 中会让整个应用白屏
class BrokenComponent extends React.Component {
  render() {
    throw new Error("组件渲染失败");
  }
}
```

## Error Boundary 的工作原理

Error Boundary 是实现了 `componentDidCatch` 生命周期方法的类组件。它能捕获**子组件树**中发生的 JavaScript 错误，记录错误信息，并展示降级 UI。

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });

    // 上报错误到监控系统
    logErrorToService(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>页面出了点问题</h2>
          <p>请刷新重试，或联系客服</p>
          {process.env.NODE_ENV === "development" && (
            <details>
              <summary>错误详情</summary>
              <pre>{this.state.error && this.state.error.toString()}</pre>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

## 使用方式

像普通组件一样包裹需要保护的子树：

```jsx
function App() {
  return (
    <div>
      <Header />

      {/* 侧边栏崩溃不影响主内容 */}
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>

      {/* 主内容区单独保护 */}
      <ErrorBoundary>
        <main>
          <Routes />
        </main>
      </ErrorBoundary>
    </div>
  );
}
```

## 粒度设计

Error Boundary 的粒度很关键，需要根据业务来设计：

**粗粒度（页面级）**：整个路由页面用一个 Error Boundary 包裹。优点是简单，缺点是一个小部件出错就会让整页降级。

**细粒度（组件级）**：每个独立的 widget 单独包裹。适合仪表盘这类由多个独立模块组成的页面：

```jsx
function Dashboard() {
  return (
    <div className="dashboard">
      <ErrorBoundary fallback={<WidgetError name="销售概览" />}>
        <SalesOverview />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="用户趋势" />}>
        <UserTrend />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="订单列表" />}>
        <RecentOrders />
      </ErrorBoundary>
    </div>
  );
}
```

这样某一个 widget 数据请求失败或渲染报错，其他模块不受影响。

## 注意：哪些错误捕获不到

Error Boundary **不能**捕获以下错误：

- 事件处理函数中的错误（用 try/catch 处理）
- 异步代码中的错误（setTimeout、Promise）
- 服务端渲染中的错误
- Error Boundary 组件自身的错误

```javascript
// 事件处理中的错误需要自己 catch
handleClick = () => {
  try {
    doSomethingDangerous();
  } catch (error) {
    this.setState({ error });
  }
};
```

## React 16 的新行为

React 16 明确规定：如果没有 Error Boundary 捕获，整个 React 组件树会被卸载。虽然看起来更严格，但 React 团队的理由是：损坏的 UI 比空白更危险（比如错误地显示了别人的订单数据）。

配合错误监控（Sentry、Bugsnag），Error Boundary 的 `componentDidCatch` 可以在用户感知到问题的同时自动上报，快速发现生产环境的崩溃。

---

_下一篇：前端性能优化关键渲染路径_
