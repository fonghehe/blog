---
title: "Vue Routerの遅延読み込みとパフォーマンス最適化"
date: 2018-06-30 09:32:13
tags:
  - Vue
readingTime: 2
description: "バックオフィス管理システムがどんどん大きくなり、ホームページの読み込み時間も長くなってきました。Vue Routerの遅延読み込みを使って初期バンドルを分割したところ、明らかに速度が改善されました。"
wordCount: 428
---

バックオフィス管理システムがどんどん大きくなり、ホームページの読み込み時間も長くなってきました。Vue Routerの遅延読み込みを使って初期バンドルを分割したところ、明らかに速度が改善されました。

## ルートの遅延読み込みとは

```javascript
// 遅延読み込みなし：すべてのページが1つのバンドルに
import Home from "./views/Home.vue";
import User from "./views/User.vue";
import Order from "./views/Order.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/user", component: User },
  { path: "/order", component: Order },
];

// 問題：ホームページにアクセスしてもUserとOrderのコードもダウンロードされる
```

```javascript
// 遅延読み込み：対応するルートにアクセスしたときだけそのページのコードをダウンロード
const routes = [
  {
    path: "/",
    component: () => import("./views/Home.vue"),
  },
  {
    path: "/user",
    component: () => import("./views/User.vue"),
  },
  {
    path: "/order",
    component: () => import("./views/Order.vue"),
  },
];
```

## グループバンドル（マジックコメント）

デフォルトでは遅延読み込みの各ルートが個別のchunkを生成します。マジックコメントを使って関連するページを同じchunkにまとめられます：

```javascript
const routes = [
  // ユーザーモジュール：同じchunkにまとめる
  {
    path: "/user/list",
    component: () =>
      import(/* webpackChunkName: "user" */ "./views/UserList.vue"),
  },
  {
    path: "/user/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "./views/UserDetail.vue"),
  },

  // 注文モジュール
  {
    path: "/order/list",
    component: () =>
      import(/* webpackChunkName: "order" */ "./views/OrderList.vue"),
  },
];
```

結果：

```
dist/
├── app.js          ← メインバンドル
├── chunk-user.js   ← ユーザーモジュール
└── chunk-order.js  ← 注文モジュール
```

## 実際の効果

プロジェクトの実数値：

```
最適化前：app.js 1.2MB（gzip後380KB）
最適化後：
  app.js：340KB（gzip後110KB）
  各機能モジュールのchunk：50〜150KB前後

初回画面読み込み：4.2秒 → 1.8秒
```

## ルートレベルのローディング状態

遅延読み込みには短い読み込み時間が生じます。ローディングコンポーネントで対処できます：

```javascript
// ローディングとエラーコンポーネントを作成
const LoadingComponent = {
  template: '<div class="loading">読み込み中...</div>',
};
const ErrorComponent = {
  template: '<div class="error">読み込みに失敗しました</div>',
};

// ローディング状態付きの遅延読み込み
function lazyLoad(componentFn) {
  return () => ({
    component: componentFn(),
    loading: LoadingComponent,
    error: ErrorComponent,
    delay: 200, // 200ms後にローディングを表示（高速ネットワークでのちらつきを防ぐ）
    timeout: 10000, // 10秒でタイムアウト
  });
}

const routes = [
  {
    path: "/dashboard",
    component: lazyLoad(() => import("./views/Dashboard.vue")),
  },
];
```

## プリフェッチ

ユーザーが遷移する前にコードを先読みします：

```javascript
// webpackPrefetch：ブラウザのアイドル時に先読み（推奨）
() => import(/* webpackPrefetch: true */ './views/UserDetail.vue')

// webpackPreload：現在のchunkと並行してダウンロード（高確率で遷移する場合に適切）
() => import(/* webpackPreload: true */ './views/Dashboard.vue')
```

バックオフィス管理システムでは、ログイン後に主要機能モジュールをプリフェッチするのが良いプラクティスです。

## まとめ

- ルートの遅延読み込み：`component: () => import('./Page.vue')`
- マジックコメント`webpackChunkName`：関連するページを同じchunkにまとめる
- 初回画面最適化：現在必要なJSのみ読み込み、他はオンデマンドで読み込む
- `webpackPrefetch`：ブラウザのアイドル時に先読みしてさらに体験を向上
