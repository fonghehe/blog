---
title: "Vue Router ナビゲーションガードの実践"
date: 2018-11-24 11:06:12
tags:
  - Vue
readingTime: 2
description: "プロジェクトが大きくなるにつれ、ルートの権限管理が複雑になります：ログインが必要なページ、管理者しかアクセスできないページ、ページを離れる前に保存確認が必要なページ……ナビゲーションガードでこれらを一元管理できます。"
---

プロジェクトが大きくなるにつれ、ルートの権限管理が複雑になります：ログインが必要なページ、管理者しかアクセスできないページ、ページを離れる前に保存確認が必要なページ……ナビゲーションガードでこれらを一元管理できます。

## グローバル前置ガード

```javascript
// router/index.js
import router from "./config";
import store from "@/store";

const WHITE_LIST = ["/login", "/register", "/forgot-password"];

router.beforeEach(async (to, from, next) => {
  const token = store.getters.token;

  if (WHITE_LIST.includes(to.path)) {
    // ホワイトリストのページは直接通過
    next();
    return;
  }

  if (!token) {
    // 未ログイン、ログインページへリダイレクト（ログイン後に元のページに戻れるよう来源パスを記録）
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  // ログイン済みだがユーザー情報なし（初回アクセスまたはページ更新時）
  if (!store.getters.userInfo) {
    try {
      await store.dispatch("user/getUserInfo");
      // 再ナビゲーション（権限情報が読み込まれたばかり）
      next({ ...to, replace: true });
    } catch (e) {
      // ユーザー情報の取得失敗（トークンが失効している可能性）
      await store.dispatch("user/logout");
      next("/login");
    }
    return;
  }

  next();
});
```

## meta ベースの権限管理

```javascript
// router/routes.js
const routes = [
  {
    path: "/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/admin",
    component: AdminPanel,
    meta: { requiresAuth: true, roles: ["admin"] },
  },
  {
    path: "/settings",
    component: Settings,
    meta: { requiresAuth: true, roles: ["admin", "editor"] },
  },
];
```

```javascript
// beforeEach で権限チェック
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !store.getters.isLoggedIn) {
    next("/login");
    return;
  }

  if (to.meta.roles) {
    const userRole = store.getters.userRole;
    if (!to.meta.roles.includes(userRole)) {
      next("/403"); // 権限なしページ
      return;
    }
  }

  next();
});
```

## コンポーネント内ガード：フォーム離脱確認

```javascript
export default {
  data() {
    return {
      isDirty: false, // フォームに未保存の変更があるか
    };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      this.$confirm("保存されていない変更があります。離れますか？", "確認", {
        confirmButtonText: "離れる",
        cancelButtonText: "留まる",
        type: "warning",
      })
        .then(() => {
          next(); // 離れることを確認
        })
        .catch(() => {
          next(false); // キャンセル、現在のページに留まる
        });
    } else {
      next();
    }
  },
};
```

## ルート専用ガード

```javascript
const routes = [
  {
    path: "/pay/:orderId",
    component: PayPage,
    // このルートのみのガード
    beforeEnter(to, from, next) {
      // 注文が支払い可能かチェック
      const orderId = to.params.orderId;
      if (!orderId || !isValidOrderId(orderId)) {
        next("/404");
        return;
      }
      next();
    },
  },
];
```

## グローバル後置フック

```javascript
// ルート切り替え完了後に実行（next は呼べない）
router.afterEach((to, from) => {
  // ページタイトルを変更
  document.title = to.meta.title || "管理システム";

  // PV を上報
  analytics.track("pageview", { path: to.path });

  // グローバル loading を閉じる
  NProgress.done();
});
```

## ログイン後に元のページへ戻る

```javascript
// ログイン成功後
const redirect = this.$route.query.redirect || "/dashboard";
this.$router.push(redirect);
```

## まとめ

- `beforeEach`：グローバル前置、ログインチェック、権限管理を処理
- `afterEach`：グローバル後置、タイトル変更、PV 上報
- `beforeRouteLeave`：コンポーネント内、フォーム離脱確認を処理
- `beforeEnter`：ルート専用、特定ルートの入場ロジックを処理
- `meta` フィールドでルートの権限要件を宣言し、ガードで一元処理
