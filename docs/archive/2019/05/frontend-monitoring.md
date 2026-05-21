---
title: "前端监控体系建设：错误捕获与性能上报"
date: 2019-05-18 10:33:34
tags:
  - 性能优化
readingTime: 2
description: "项目上线后出了问题，往往是用户先发现，然后反馈给运营，再到研发。建立一套监控体系，让我们比用户先发现问题。"
wordCount: 240
---

项目上线后出了问题，往往是用户先发现，然后反馈给运营，再到研发。建立一套监控体系，让我们比用户先发现问题。

## 错误监控

### 全局错误捕获

```javascript
// 未捕获的 JS 错误
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

// 未处理的 Promise rejection
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

// 资源加载失败（图片、CSS、JS）
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

### Vue 错误捕获

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

## 性能监控

```javascript
// 使用 Performance API
function collectPerformanceMetrics() {
  const timing = performance.timing;

  const metrics = {
    // DNS 解析
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    // TCP 连接
    tcp: timing.connectEnd - timing.connectStart,
    // 首字节时间（TTFB）
    ttfb: timing.responseStart - timing.requestStart,
    // DOM 解析
    domParse: timing.domInteractive - timing.responseEnd,
    // 首屏加载（近似）
    fcp: timing.domContentLoadedEventEnd - timing.navigationStart,
    // 页面完全加载
    load: timing.loadEventEnd - timing.navigationStart,
  };

  report({ type: "performance", ...metrics, url: location.href });
}

// Paint Timing API（更精确的 FCP、LCP）
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-contentful-paint") {
      report({ type: "fcp", value: entry.startTime });
    }
  }
});
observer.observe({ entryTypes: ["paint", "largest-contentful-paint"] });
```

## 上报机制

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

    // 使用 sendBeacon（页面卸载时也能发送）
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

// 页面隐藏/卸载时立即上报
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    monitor.flush();
  }
});
```

## Source Map 还原

生产环境 JS 经过压缩，stack trace 看不懂：

```
TypeError: Cannot read property 'name' of undefined
    at t.e (app.min.js:1:23456)
```

需要用 Source Map 还原：

```bash
# 构建时生成 source map（不要上传到 CDN！）
webpack --devtool source-map

# 上传 source map 到错误追踪服务（如 Sentry）
sentry-cli releases files 1.0.0 upload-sourcemaps ./dist
```

## 开源方案 vs 自建

| 方案             | 优势                     | 劣势               |
| 
---------------- | ------------------------ | ------------------ |
| Sentry           | 功能完整、生态好         | 收费（有免费配额） |
| 阿里云 ARMS      | 国内访问快、和阿里云集成 | 收费               |
| 自建（上报+ELK） | 数据自控、成本可控       | 运维成本高         |

中小团队推荐 Sentry，数据量大的大团队考虑自建。

## 小结

- 错误监控：`window.error`、`unhandledrejection`、框架错误处理
- 性能监控：Performance API、Paint Timing API
- `sendBeacon` 保证页面卸载时也能发送数据
- 生产 Source Map 上传到监控平台，还原可读的错误堆栈
