---
title: "React 16 錯誤邊界：告別白屏崩潰"
date: 2018-01-09 11:00:56
tags:
  - React
readingTime: 3
description: "React 16 在 2017 年 9 月發布，帶來了 Fiber 架構重寫，但對日常開發影響最直接的特性之一是錯誤邊界（Error Boundaries）。這個特性解決了 React 應用長期以來的一個痛點：一個元件拋出未捕獲的例外，整個應用樹就白屏了。"
---

React 16 在 2017 年 9 月發布，帶來了 Fiber 架構重寫，但對日常開發影響最直接的特性之一是錯誤邊界（Error Boundaries）。這個特性解決了 React 應用長期以來的一個痛點：一個元件拋出未捕獲的例外，整個應用樹就白屏了。

## React 15 的問題

在 React 15 及更早版本，元件渲染期間的錯誤會讓 React 進入不可預知的狀態，有時渲染損壞的 UI，有時什麼都不顯示。React 官方後來把這個行為改成了明確的「卸載整個元件樹」——但這意味著使用者看到的是一片空白。

```javascript
// 這在 React 15 中會讓整個應用白屏
class BrokenComponent extends React.Component {
  render() {
    throw new Error("元件渲染失敗");
  }
}
```

## Error Boundary 的工作原理

Error Boundary 是實作了 `componentDidCatch` 生命週期方法的類別元件。它能捕獲**子元件樹**中發生的 JavaScript 錯誤，記錄錯誤資訊，並展示降級 UI。

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

    // 上報錯誤到監控系統
    logErrorToService(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>頁面出了點問題</h2>
          <p>請重新整理後再試，或聯絡客服</p>
          {process.env.NODE_ENV === "development" && (
            <details>
              <summary>錯誤詳情</summary>
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

像普通元件一樣包裹需要保護的子樹：

```jsx
function App() {
  return (
    <div>
      <Header />

      {/* 側邊欄崩潰不影響主內容 */}
      <ErrorBoundary>
        <Sidebar />
      </ErrorBoundary>

      {/* 主內容區單獨保護 */}
      <ErrorBoundary>
        <main>
          <Routes />
        </main>
      </ErrorBoundary>
    </div>
  );
}
```

## 粒度設計

Error Boundary 的粒度很關鍵，需要根據業務來設計：

**粗粒度（頁面級）**：整個路由頁面用一個 Error Boundary 包裹。優點是簡單，缺點是一個小元件出錯就會讓整頁降級。

**細粒度（元件級）**：每個獨立的 widget 單獨包裹。適合儀表板這類由多個獨立模組組成的頁面：

```jsx
function Dashboard() {
  return (
    <div className="dashboard">
      <ErrorBoundary fallback={<WidgetError name="銷售概覽" />}>
        <SalesOverview />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="使用者趨勢" />}>
        <UserTrend />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="訂單列表" />}>
        <RecentOrders />
      </ErrorBoundary>
    </div>
  );
}
```

這樣某一個 widget 資料請求失敗或渲染報錯，其他模組不受影響。

## 注意：哪些錯誤捕獲不到

Error Boundary **不能**捕獲以下錯誤：

- 事件處理函式中的錯誤（用 try/catch 處理）
- 非同步程式碼中的錯誤（setTimeout、Promise）
- 伺服端渲染中的錯誤
- Error Boundary 元件自身的錯誤

```javascript
// 事件處理中的錯誤需要自己 catch
handleClick = () => {
  try {
    doSomethingDangerous();
  } catch (error) {
    this.setState({ error });
  }
};
```

## React 16 的新行為

React 16 明確規定：如果沒有 Error Boundary 捕獲，整個 React 元件樹會被卸載。雖然看起來更嚴格，但 React 團隊的理由是：損壞的 UI 比空白更危險（比如錯誤地顯示了別人的訂單資料）。

搭配錯誤監控（Sentry、Bugsnag），Error Boundary 的 `componentDidCatch` 可以在使用者感知到問題的同時自動上報，快速發現正式環境的崩潰。

---

_下一篇：前端效能優化關鍵渲染路徑_
