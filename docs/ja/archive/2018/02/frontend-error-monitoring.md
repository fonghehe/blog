---
title: "フロントエンドエラー監視：window.onerror から Sentry まで"
date: 2018-02-22 16:21:00
tags:
  - パフォーマンス最適化
readingTime: 2
description: "監視なしでは本番のバグはサイレントです — ユーザーはただ離れていくだけです。エラー監視の設定はフロントエンドプロジェクトの中で最も ROI の高い投資の一つです。"
---

監視なしでは本番のバグはサイレントです — ユーザーはただ離れていくだけです。エラー監視の設定はフロントエンドプロジェクトの中で最も ROI の高い投資の一つです。

## エラー監視が必要な理由

- ブラウザ環境は OS、バージョン、拡張機能、ネットワークで大きく異なる
- 全ユーザー環境をローカルで再現できない
- ユーザーはバグを報告することは少なく、ただ使わなくなる
- ソースマップを使えば実際のコードを確認できる（難読化されたコードでなく）

## window.onerror：基礎

```javascript
window.onerror = function (message, source, lineno, colno, error) {
  console.error("キャッチされていないエラー:", {
    message,
    source,
    lineno,
    colno,
  });

  fetch("/api/errors", {
    method: "POST",
    body: JSON.stringify({
      message,
      stack: error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }),
  });

  return false;
};
```

## 未処理の Promise 拒否のハンドリング

`window.onerror` は Promise の拒否をキャッチしません：

```javascript
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  reportError({
    message: reason?.message || String(reason),
    stack: reason?.stack,
    type: "unhandledrejection",
  });
});
```

## クロスオリジンスクリプト

JS ファイルが CDN（別オリジン）にある場合、`window.onerror` はブラウザのセキュリティポリシーにより `"Script error."` しか受け取れません。

修正：スクリプトタグに `crossorigin="anonymous"` を追加し、CDN に適切な CORS ヘッダーを設定：

```html
<script src="https://cdn.example.com/app.js" crossorigin="anonymous"></script>
```

## ソースマップ

```javascript
// webpack.config.js
module.exports = {
  devtool: "hidden-source-map", // .map ファイルを生成するが JS からリンクしない
};
```

**重要**：ソースマップを一般公開しないでください（ソースコードが露出します）。エラー報告サービスにアップロードし、ブラウザには配信しない。

## Sentry 統合

手動での報告はすぐに複雑になります。Sentry が全てを自動的に処理します：

```bash
npm install @sentry/vue @sentry/tracing
```

```javascript
// main.js
import * as Sentry from "@sentry/vue";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  app,
  dsn: "https://your-dsn@sentry.io/project-id",
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.vueRouterInstrumentation(router),
    }),
  ],
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  release: process.env.VUE_APP_VERSION,
});
```

Sentry が自動的に行うこと：

- キャッチされていないエラーと未処理の拒否をキャプチャ
- 読みやすいスタックトレースのためにソースマップをリンク
- 重複エラーをグループ化
- エラーごとの影響ユーザーを追跡

## 手動でエラーを報告

```javascript
try {
  const result = parseWeirdData(input);
} catch (err) {
  Sentry.captureException(err, {
    extra: { input, userId: currentUser.id },
    tags: { feature: "data-import" },
  });
}

Sentry.setUser({ id: user.id, email: user.email });
```
