---
title: "Vue 2 非同期コンポーネント読み込み"
date: 2019-07-02 17:09:18
tags:
  - Vue
readingTime: 2
description: "アプリが成長するにつれ、全コンポーネントを1つのバンドルに含めるとパフォーマンスのボトルネックになります。Vue 2 の非同期コンポーネント機能を使うと、コンポーネント定義を別のチャンクに分割し、必要なときだけ読み込めます。"
---

アプリが成長するにつれ、全コンポーネントを1つのバンドルに含めるとパフォーマンスのボトルネックになります。Vue 2 の非同期コンポーネント機能を使うと、コンポーネント定義を別のチャンクに分割し、必要なときだけ読み込めます。

## 基本的な非同期コンポーネント

最もシンプルな形：コンポーネント定義に解決される Promise を返す：

```javascript
// ルーターや親コンポーネント内で
const AsyncDashboard = () => import("./views/Dashboard.vue");

const router = new VueRouter({
  routes: [{ path: "/dashboard", component: AsyncDashboard }],
});
```

## ローディング/エラー状態を持つ高度なファクトリ関数

Vue 2 はローディングとエラー UI を制御する高度なファクトリ関数をサポートします：

```javascript
const AsyncComponent = () => ({
  component: import("./HeavyComponent.vue"),
  loading: LoadingSpinner, // ローディング中に表示
  error: ErrorDisplay, // 読み込みに失敗した場合に表示
  delay: 200, // ローディング表示前に 200ms 待機
  timeout: 10000, // 10秒後にエラー
});
```

## Webpack でのルートレベルコード分割

デバッグのためにチャンク名を付ける：

```javascript
const routes = [
  {
    path: "/",
    component: () => import(/* webpackChunkName: "home" */ "./views/Home.vue"),
  },
  {
    path: "/admin",
    component: () =>
      import(/* webpackChunkName: "admin" */ "./views/Admin.vue"),
  },
  // 関連ページを1つのチャンクにまとめる
  {
    path: "/admin/users",
    component: () =>
      import(/* webpackChunkName: "admin" */ "./views/AdminUsers.vue"),
  },
];
```

## プリフェッチとプリロード

```javascript
// プリフェッチ：低優先度、アイドル時に読み込む
() => import(/* webpackPrefetch: true */ './views/Settings.vue')

// プリロード：高優先度、現在のチャンクと並行して読み込む
() => import(/* webpackPreload: true */ './utils/heavyLib.js')
```

## まとめ

- 非同期コンポーネントでコンポーネントレベルのコード分割が可能
- ローディング/エラー状態やタイムアウト制御には高度なファクトリ関数を使用
- `webpackChunkName` で関連コンポーネントを1つのチャンクにまとめられる
- プリフェッチヒントで次の画面遷移の体感パフォーマンスを向上させられる
