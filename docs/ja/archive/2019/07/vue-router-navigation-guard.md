---
title: "Vue Router ナビゲーションガード完全ガイド"
date: 2019-07-03 10:02:55
tags:
  - Vue
readingTime: 2
description: "ナビゲーションガードは Vue Router のルートアクセスを制御するメカニズムです。認証チェック、権限検証、データプリフェッチなどに利用できます。この記事では全ナビゲーションガードの種類と実行順序を解説します。"
---

ナビゲーションガードは Vue Router のルートアクセスを制御するメカニズムです。認証チェック、権限検証、データプリフェッチなどに利用できます。この記事では全ナビゲーションガードの種類と実行順序を解説します。

## ナビゲーションガードの種類

Vue Router は3種類のナビゲーションガードを提供します：

1. **グローバルガード** — 全ルートに適用
2. **ルート単位のガード** — 特定のルート設定に定義
3. **コンポーネント内ガード** — コンポーネントオプション内に定義

## グローバルガード

### beforeEach

最もよく使われるグローバルガードで、ナビゲーション前に毎回実行されます：

```javascript
router.beforeEach((to, from, next) => {
  const isAuthenticated = store.getters.isAuthenticated;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: "Login", query: { redirect: to.fullPath } });
  } else {
    next(); // 処理を続けるには必ず next() を呼ぶ
  }
});
```

### afterEach

ナビゲーション確定後に実行されます。既にナビゲーションが完了しているため `next` 関数はありません：

```javascript
router.afterEach((to, from) => {
  // アナリティクス
  window.analytics?.track("Page View", { page: to.name });

  // ドキュメントタイトルを更新
  document.title = to.meta.title || "My App";
});
```

## ルート単位のガード

```javascript
const routes = [
  {
    path: "/admin",
    component: AdminLayout,
    beforeEnter: (to, from, next) => {
      const user = store.getters.currentUser;
      if (!user?.roles.includes("admin")) {
        next({ name: "Forbidden" });
      } else {
        next();
      }
    },
  },
];
```

## コンポーネント内ガード

```javascript
export default {
  beforeRouteEnter(to, from, next) {
    // コンポーネント作成前に呼ばれる
    // 'this' は使えない
    next((vm) => {
      // vm 経由でコンポーネントインスタンスにアクセス
      vm.fetchUser(to.params.id);
    });
  },

  beforeRouteUpdate(to, from, next) {
    // ルートが変わるがコンポーネントが再利用される場合
    // e.g., /user/1 -> /user/2
    this.fetchUser(to.params.id);
    next();
  },

  beforeRouteLeave(to, from, next) {
    // コンポーネントを離れる前
    if (this.hasUnsavedChanges) {
      const confirmed = window.confirm("未保存の変更があります。離れますか？");
      next(confirmed);
    } else {
      next();
    }
  },
};
```

## 実行順序

```
1. ナビゲーション開始
2. beforeRouteLeave（離れるコンポーネント）
3. beforeEach（グローバル）
4. beforeRouteUpdate（再利用されるコンポーネント）
5. beforeEnter（ルート設定）
6. 非同期ルートコンポーネントを解決
7. beforeRouteEnter（入るコンポーネント）
8. beforeResolve（グローバル）
9. ナビゲーション確定
10. afterEach（グローバル）
11. DOM 更新
12. beforeRouteEnter の next() コールバック
```

## まとめ

- **グローバルガード**：`beforeEach`、`beforeResolve`、`afterEach` — 全ルートに適用
- **ルート単位のガード**：`beforeEnter` — ルート固有のアクセス制御
- **コンポーネント内ガード**：`beforeRouteEnter`、`beforeRouteUpdate`、`beforeRouteLeave`
- ナビゲーションが止まらないよう必ず `next()` を呼ぶこと
- `beforeRouteEnter` はコンポーネント作成前に実行されるため、`next(vm => ...)` でインスタンスにアクセスする
