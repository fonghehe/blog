---
title: "前端監控體系建設：錯誤捕獲與性能上報"
date: 2019-05-18 10:33:34
tags:
  - 性能優化
readingTime: 2
description: "項目上線後出了問題，往往是用户先發現，然後反饋給運營，再到研發。建立一套監控體系，讓我們比用户先發現問題。"
wordCount: 240
---

項目上線後出了問題，往往是用户先發現，然後反饋給運營，再到研發。建立一套監控體系，讓我們比用户先發現問題。

## 錯誤監控

### 全局錯誤捕獲

```javascript
// 未捕獲的 JS 錯誤
window.addEventListener(
  "error",
  (event) => {
    const { message, filename, lineno, colno, error } = event;

    report({
      type: "js_error",
      message,
      stack: error?.stack,
      filename,
      position: `${lineno}:${colno}`,
      url: location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    });
  },
  true,
);

// 未處理的 Promise rejection
window.addEventListener("unhandledrejection", (event) => {
  const { reason } = event;
  report({
    type: "promise_error",
    message: reason?.message || String(reason),
    stack: reason?.stack,
    url: location.href,
    timestamp: Date.now(),
  });
});

// 資源加載失敗（圖片、CSS、JS）
window.addEventListener(
  "error",
  (event) => {
    const target = event.target;
    if (target !== window) {
      report({
        type: "resource_error",
        tagName: target.tagName,
        src: target.src || target.href,
        url: location.href,
        timestamp: Date.now(),
      });
    }
  },
  true,
);
```

### Vue 錯誤捕獲

```javascript
// Vue 2
Vue.config.errorHandler = (error, vm, info) => {
  report({
    type: "vue_error",
    message: error.message,
    stack: error.stack,
    componentName: vm.$options.name,
    lifecycleHook: info,
    url: location.href,
  });
};

// Vue 3
app.config.errorHandler = (error, instance, info) => {
  report({ type: "vue_error", message: error.message, info });
};

// React Error Boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    report({
      type: "react_error",
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) return <ErrorPage />;
    return this.props.children;
  }
}
```

## 性能監控

```javascript
// 使用 Performance API
function collectPerformanceMetrics() {
  const timing = performance.timing;

  const metrics = {
    // DNS 解析
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    // TCP 連接
    tcp: timing.connectEnd - timing.connectStart,
    // 首字節時間（TTFB）
    ttfb: timing.responseStart - timing.requestStart,
    // DOM 解析
    domParse: timing.domInteractive - timing.responseEnd,
    // 首屏加載（近似）
    fcp: timing.domContentLoadedEventEnd - timing.navigationStart,
    // 頁面完全加載
    load: timing.loadEventEnd - timing.navigationStart,
  };

  report({ type: "performance", ...metrics, url: location.href });
}

// Paint Timing API（更精確的 FCP、LCP）
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-contentful-paint") {
      report({ type: "fcp", value: entry.startTime });
    }
  }
});
observer.observe({ entryTypes: ["paint", "largest-contentful-paint"] });
```

## 上報機制

```javascript
class Monitor {
  constructor(config) {
    this.config = config;
    this.queue = [];
    this.timer = null;
  }

  report(data) {
    this.queue.push({
      ...data,
      appVersion: this.config.version,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
    });

    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 5000);
  }

  flush() {
    if (this.queue.length === 0) return;

    const data = this.queue.splice(0);
    this.timer = null;

    // 使用 sendBeacon（頁面卸載時也能發送）
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    navigator.sendBeacon(this.config.endpoint, blob);
  }

  getUserId() {
    return localStorage.getItem("userId") || "anonymous";
  }

  getSessionId() {
    if (!this._sessionId) {
      this._sessionId = Math.random().toString(36).slice(2);
    }
    return this._sessionId;
  }
}

// 頁面隱藏/卸載時立即上報
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    monitor.flush();
  }
});
```

## Source Map 還原

生產環境 JS 經過壓縮，stack trace 看不懂：

```
TypeError: Cannot read property 'name' of undefined
    at t.e (app.min.js:1:23456)
```

需要用 Source Map 還原：

```bash
# 構建時生成 source map（不要上傳到 CDN！）
webpack --devtool source-map

# 上傳 source map 到錯誤追蹤服務（如 Sentry）
sentry-cli releases files 1.0.0 upload-sourcemaps ./dist
```

## 開源方案 vs 自建

| 方案             | 優勢                     | 劣勢               |
| 
---------------- | ------------------------ | ------------------ |
| Sentry           | 功能完整、生態好         | 收費（有免費配額） |
| 阿里雲 ARMS      | 國內訪問快、和阿里雲集成 | 收費               |
| 自建（上報+ELK） | 數據自控、成本可控       | 運維成本高         |

中小團隊推薦 Sentry，數據量大的大團隊考慮自建。

## 小結

- 錯誤監控：`window.error`、`unhandledrejection`、框架錯誤處理
- 性能監控：Performance API、Paint Timing API
- `sendBeacon` 保證頁面卸載時也能發送數據
- 生產 Source Map 上傳到監控平台，還原可讀的錯誤堆棧
