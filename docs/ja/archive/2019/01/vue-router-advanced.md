---
title: "Vue Router応用：ナビゲーションガードと権限制御"
date: 2019-01-20 16:47:45
tags:
  - Vue
readingTime: 1
description: "Vue Routerの基本的な使い方はシンプルだが、権限制御、ルートメタ情報、動的なルート追加といった応用機能は、実際のプロジェクトでうまく活用されていないことが多い。"
wordCount: 200
---

Vue Routerの基本的な使い方はシンプルだが、権限制御、ルートメタ情報、動的なルート追加といった応用機能は、実際のプロジェクトでうまく活用されていないことが多い。

## ナビゲーションガードの実行順序

```
beforeEach → beforeRouteUpdate → beforeEnter →
beforeRouteEnter → afterEach → beforeRouteEnterのnextコールバック
```

```javascript
// グローバル前置ガード
router.beforeEach((to, from, next) => {
  // to：これから入るルート
  // from：現在のルート
  // next()：通過、next(false)：中断、next('/login')：リダイレクト

  const isLoggedIn = store.getters["user/isLoggedIn"];

  if (to.meta.requiresAuth && !isLoggedIn) {
    next({ path: "/login", query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

// グローバル後置フック（ナビゲーションに影響しない）
router.afterEach((to, from) => {
  // ページタイトルを更新
  document.title = to.meta.title || "デフォルトタイトル";
});
```

## ルートメタ情報

```javascript
const routes = [
  {
    path: "/admin",
    component: AdminLayout,
    meta: { requiresAuth: true, roles: ["admin", "superadmin"] },
    children: [
      {
        path: "users",
        component: UserList,
        meta: { requiresAuth: true, roles: ["admin"], title: "ユーザー管理" },
      },
    ],
  },
];
```

## ロールベースの権限制御

```javascript
router.beforeEach((to, from, next) => {
  const userRole = store.getters["user/role"];

  // matchedにはマッチした全ルートレコード（ネストした親を含む）が含まれる
  const requiredRoles = to.matched.flatMap((record) => record.meta.roles || []);

  if (requiredRoles.length === 0) {
    next();
    return;
  }

  if (!userRole || !requiredRoles.includes(userRole)) {
    next("/403");
    return;
  }

  next();
});
```

## 動的ルート追加（バックエンド権限メニュー）

フロントエンドでよくある要件：バックエンドがユーザーの権限のあるメニューを返し、フロントエンドが動的にルートを登録する。

```javascript
// ルート設定
const asyncRoutes = {
  "user-manage": {
    path: "/user-manage",
    component: () => import("@/views/UserManage"),
  },
  "order-list": {
    path: "/order-list",
    component: () => import("@/views/OrderList"),
  },
};

// ログイン後、権限に基づいて動的にルートを追加
async function setupAsyncRoutes(permissions) {
  const routes = permissions
    .filter((p) => asyncRoutes[p])
    .map((p) => asyncRoutes[p]);

  // Vue Router 3.xのメソッド
  routes.forEach((route) => router.addRoute(route));
}

// ログインアクション
async function login({ commit }, credentials) {
  const { user, token, permissions } = await api.login(credentials);
  commit("SET_USER", user);
  await setupAsyncRoutes(permissions);
  router.push("/dashboard");
}
```

## 遅延ロードルート + チャンクグループ化

```javascript

```
