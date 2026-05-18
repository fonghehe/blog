---
title: "React 16 錯誤邊界：告別白屏崩潰"
date: 2018-01-09 11:00:56
tags:
  - React
readingTime: 3
description: "React 16 喺 2017 年 9 月發布，帶嚟咗 Fiber 架構重寫，但對日常開發影響最直接嘅特性之一係錯誤邊界（Error Boundaries）。呢個特性解決咗 React 應用長期以來嘅一個痛點：一個組件拋出未捕獲嘅異常，整個應用樹就白屏咗。"
---

React 16 喺 2017 年 9 月發布，帶嚟咗 Fiber 架構重寫，但對日常開發影響最直接嘅特性之一係錯誤邊界（Error Boundaries）。呢個特性解決咗 React 應用長期以來嘅一個痛點：一個組件拋出未捕獲嘅異常，整個應用樹就白屏咗。

## React 15 嘅問題

喺 React 15 及更早版本，組件渲染期間嘅錯誤會令 React 進入唔可預知嘅狀態，有時渲染損壞嘅 UI，有時咩都唔顯示。React 官方後來將呢個行為改成咗明確嘅「卸載整個組件樹」——但呢個意味著用戶睇到嘅係一片空白。

```javascript
// 呢個喺 React 15 中會令整個應用白屏
class BrokenComponent extends React.Component {
  render() {
    throw new Error("組件渲染失敗");
  }
}
```

## Error Boundary 嘅工作原理

Error Boundary 係實現咗 `componentDidCatch` 生命週期方法嘅類組件。佢能夠捕獲**子組件樹**中發生嘅 JavaScript 錯誤，記錄錯誤信息，並展示降級 UI。

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
          <h2>頁面出咗啲問題</h2>
          <p>請刷新重試，或者聯絡客服</p>
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

好似普通組件咁包裹需要保護嘅子樹：

```jsx
function App() {
  return (
    <div>
      <Header />

      {/* 側邊欄崩潰唔影響主內容 */}
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

Error Boundary 嘅粒度好關鍵，需要根據業務嚟設計：

**粗粒度（頁面級）**：整個路由頁面用一個 Error Boundary 包裹。優點係簡單，缺點係一個小組件出錯就會令整頁降級。

**細粒度（組件級）**：每個獨立嘅 widget 單獨包裹。適合儀表板呢類由多個獨立模塊組成嘅頁面：

```jsx
function Dashboard() {
  return (
    <div className="dashboard">
      <ErrorBoundary fallback={<WidgetError name="銷售概覽" />}>
        <SalesOverview />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="用戶趨勢" />}>
        <UserTrend />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetError name="訂單列表" />}>
        <RecentOrders />
      </ErrorBoundary>
    </div>
  );
}
```

咁樣某一個 widget 數據請求失敗或渲染報錯，其他模塊唔受影響。

## 注意：邊啲錯誤捕獲唔到

Error Boundary **唔能夠**捕獲以下錯誤：

- 事件處理函數中嘅錯誤（用 try/catch 處理）
- 異步代碼中嘅錯誤（setTimeout、Promise）
- 服務端渲染中嘅錯誤
- Error Boundary 組件自身嘅錯誤

```javascript
// 事件處理中嘅錯誤需要自己 catch
handleClick = () => {
  try {
    doSomethingDangerous();
  } catch (error) {
    this.setState({ error });
  }
};
```

## React 16 嘅新行為

React 16 明確規定：如果冇 Error Boundary 捕獲，整個 React 組件樹會被卸載。雖然睇起嚟更嚴格，但 React 團隊嘅理由係：損壞嘅 UI 比空白更危險（例如錯誤地顯示咗別人嘅訂單數據）。

配合錯誤監控（Sentry、Bugsnag），Error Boundary 嘅 `componentDidCatch` 可以喺用戶感知到問題嘅同時自動上報，快速發現生產環境嘅崩潰。

---

_下一篇：前端性能優化關鍵渲染路徑_
