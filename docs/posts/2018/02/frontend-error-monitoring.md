---
title: "前端错误监控：从 window.onerror 到 Sentry"
date: 2018-02-22 16:21:00
tags:
  - 性能优化
---

过了年假回来，接手了一个线上 bug，花了两天才定位到，根本原因是没有错误监控。这篇文章整理一下前端错误监控的方案。

## 为什么需要前端错误监控

用户不会告诉你报错了。他们会默默关掉页面，或者直接流失。
没有监控 = 不知道线上有多少错误 = 无法量化质量。

## 基础：window.onerror

捕获未处理的 JS 运行时错误：

```javascript
window.onerror = function (message, source, lineno, colno, error) {
  console.log({
    message, // 错误信息
    source, // 文件 URL
    lineno, // 行号
    colno, // 列号
    error, // Error 对象（有 stack）
  });

  // 上报到服务器
  reportError({ message, source, lineno, colno, stack: error?.stack });

  return false; // 不阻止默认处理
};
```

**局限性**：

- 只能捕获全局运行时错误
- 不能捕获 Promise 内部的错误
- 跨域脚本错误只显示 "Script error."（需要 crossorigin 属性）

## 处理 Promise 错误

```javascript
// 未处理的 Promise rejection
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  reportError({
    message: error?.message || String(error),
    stack: error?.stack,
  });
});
```

```javascript
// 比较完整的全局错误处理
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

## 跨域脚本错误

CDN 托管的脚本报错，浏览器会隐藏细节（安全策略），只给你 "Script error."。

解决方案：

```html
<!-- 1. 添加 crossorigin 属性 -->
<script src="https://cdn.example.com/app.js" crossorigin="anonymous"></script>
```

```
# 2. CDN 服务器响应头添加
Access-Control-Allow-Origin: *
```

两者都配置才能拿到完整错误信息。

## Source Map 与错误定位

生产代码是压缩混淆的，错误堆栈的行号列号毫无意义。需要 Source Map。

### Webpack 生成 Source Map

```javascript
// webpack.config.js (production)
module.exports = {
  devtool: "hidden-source-map", // 生成但不暴露给浏览器
  // 'source-map' 会暴露源码，不要用在生产环境
};
```

### 上报时附带 Source Map 信息

```javascript
// 服务端用 source-map 库还原原始位置
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

以上这些自己实现起来比较繁琐，推荐直接用 Sentry，它把这些都处理好了。

### 安装

```bash
npm install @sentry/browser
```

### 初始化

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://xxx@sentry.io/xxx", // 从 Sentry 控制台获取
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

### 主动上报

```javascript
// 捕获异常
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  // 继续你的错误处理逻辑
}

// 添加上下文（帮助排查）
Sentry.setUser({ id: "123", email: "user@example.com" });
Sentry.setTag("page", "checkout");
Sentry.addBreadcrumb({ message: "用户点击了提交按钮", level: "info" });
```

## Sentry + Source Map 上传

```bash
# 安装 Sentry CLI
npm install -g @sentry/cli

# 上传 Source Map
sentry-cli releases files VERSION upload-sourcemaps ./dist \
  --url-prefix '~/static/'
```

或者用 Webpack 插件自动上传：

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

## 小结

- `window.onerror` + `unhandledrejection` 是基础兜底
- 跨域脚本需要配置 `crossorigin` + CORS 头
- 生产环境必须配置 Source Map，否则错误信息没有价值
- 直接用 Sentry 是最省事的方案，功能完整
- 部署新版本时，记得同步上传对应的 Source Map
