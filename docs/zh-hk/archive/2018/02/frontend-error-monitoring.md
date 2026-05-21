---
title: "前端錯誤監控：從 window.onerror 到 Sentry"
date: 2018-02-22 16:21:00
tags:
  - 性能優化
readingTime: 2
description: "過了年假回來，接手了一個線上 bug，花了兩天才定位到，根本原因是沒有錯誤監控。這篇文章整理一下前端錯誤監控的方案。"
wordCount: 415
---

過了年假回來，接手了一個線上 bug，花了兩天才定位到，根本原因是沒有錯誤監控。這篇文章整理一下前端錯誤監控的方案。

## 為什麼需要前端錯誤監控

用户不會告訴你報錯了。他們會默默關掉頁面，或者直接流失。
沒有監控 = 不知道線上有多少錯誤 = 無法量化質量。

## 基礎：window.onerror

捕獲未處理的 JS 運行時錯誤：

```javascript
window.onerror = function (message, source, lineno, colno, error) {
  console.log({
    message, // 錯誤信息
    source, // 文件 URL
    lineno, // 行號
    colno, // 列號
    error, // Error 對象（有 stack）
  });

  // 上報到服務器
  reportError({ message, source, lineno, colno, stack: error?.stack });

  return false; // 不阻止默認處理
};
```

**侷限性**：

- 只能捕獲全局運行時錯誤
- 不能捕獲 Promise 內部的錯誤
- 跨域腳本錯誤只顯示 "Script error."（需要 crossorigin 屬性）

## 處理 Promise 錯誤

```javascript
// 未處理的 Promise rejection
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  reportError({
    message: error?.message || String(error),
    stack: error?.stack,
  });
});
```

```javascript
// 比較完整的全局錯誤處理
window.onerror = (msg, url, line, col, err) => {
  reportError({
    type: "runtime",
    message: msg,
    url,
    line,
    col,
    stack: err?.stack,
  });
};

window.addEventListener("unhandledrejection", (event) => {
  reportError({ type: "promise", message: String(event.reason) });
});
```

## 跨域腳本錯誤

CDN 託管的腳本報錯，瀏覽器會隱藏細節（安全策略），只給你 "Script error."。

解決方案：

```html
<!-- 1. 添加 crossorigin 屬性 -->
<script src="https://cdn.example.com/app.js" crossorigin="anonymous"></script>
```

```
# 2. CDN 服務器響應頭添加
Access-Control-Allow-Origin: *
```

兩者都配置才能拿到完整錯誤信息。

## Source Map 與錯誤定位

生產代碼是壓縮混淆的，錯誤堆棧的行號列號毫無意義。需要 Source Map。

### Webpack 生成 Source Map

```javascript
// webpack.config.js (production)
module.exports = {
  devtool: "hidden-source-map", // 生成但不暴露給瀏覽器
  // 'source-map' 會暴露源碼，不要用在生產環境
};
```

### 上報時附帶 Source Map 信息

```javascript
// 服務端用 source-map 庫還原原始位置
const { SourceMapConsumer } = require("source-map");

async function resolveError(errorInfo) {
  const consumer = await new SourceMapConsumer(sourceMapContent);
  const originalPosition = consumer.originalPositionFor({
    line: errorInfo.line,
    column: errorInfo.column,
  });
  // { source: 'src/components/App.vue', line: 42, column: 8 }
}
```

## 直接用 Sentry

以上這些自己實現起來比較繁瑣，推薦直接用 Sentry，它把這些都處理好了。

### 安裝

```bash
npm install @sentry/browser
```

### 初始化

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://xxx@sentry.io/xxx", // 從 Sentry 控制台獲取
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
});
```

### Vue 集成

```javascript
import * as Sentry from "@sentry/browser";
import { Vue as VueIntegration } from "@sentry/integrations";

Sentry.init({
  dsn: "...",
  integrations: [new VueIntegration({ Vue, attachProps: true })],
});
```

### 主動上報

```javascript
// 捕獲異常
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  // 繼續你的錯誤處理邏輯
}

// 添加上下文（幫助排查）
Sentry.setUser({ id: "123", email: "user@example.com" });
Sentry.setTag("page", "checkout");
Sentry.addBreadcrumb({ message: "用户點擊了提交按鈕", level: "info" });
```

## Sentry + Source Map 上傳

```bash
# 安裝 Sentry CLI
npm install -g @sentry/cli

# 上傳 Source Map
sentry-cli releases files VERSION upload-sourcemaps ./dist \
  --url-prefix '~/static/'
```

或者用 Webpack 插件自動上傳：

```bash
npm install @sentry/webpack-plugin
```

```javascript
const SentryWebpackPlugin = require("@sentry/webpack-plugin");

module.exports = {
  plugins: [
    new SentryWebpackPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "my-org",
      project: "my-project",
      include: "./dist",
      urlPrefix: "~/static/",
    }),
  ],
};
```

## 小結

- `window.onerror` + `unhandledrejection` 是基礎兜底
- 跨域腳本需要配置 `crossorigin` + CORS 頭
- 生產環境必須配置 Source Map，否則錯誤信息沒有價值
- 直接用 Sentry 是最省事的方案，功能完整
- 部署新版本時，記得同步上傳對應的 Source Map
