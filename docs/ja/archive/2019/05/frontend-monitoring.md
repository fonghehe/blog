---
title: "フロントエンド監視体制の構築：エラー捕捉とパフォーマンス計測"
date: 2019-05-18 10:33:34
tags:
  - パフォーマンス最適化
readingTime: 1
description: "プロジェクトがリリースされた後に問題が発生すると、通常はユーザーが先に発見し、運営に報告され、開発チームに届きます。監視体制を構築することで、ユーザーより先に問題を発見できるようになります。"
---

プロジェクトがリリースされた後に問題が発生すると、通常はユーザーが先に発見し、運営に報告され、開発チームに届きます。監視体制を構築することで、ユーザーより先に問題を発見できるようになります。

## エラー監視

### グローバルエラー捕捉

```javascript
// キャッチされていないJSエラー
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

// 未処理のPromise rejection
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

// リソース読み込み失敗（画像・CSS・JS）
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

### Vueのエラー捕捉

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
```

## パフォーマンス監視

Performance APIを使ってCore Web Vitalsを収集：

```javascript
// Largest Contentful Paint
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  report({ type: "lcp", value: lastEntry.startTime });
}).observe({ type: "largest-contentful-paint", buffered: true });

// First Input Delay
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    report({ type: "fid", value: entry.processingStart - entry.startTime });
  });
}).observe({ type: "first-input", buffered: true });
```

堅牢な監視システムは積極的なサイト信頼性管理の基盤です——ユーザーが報告する前に問題をキャッチしましょう。
