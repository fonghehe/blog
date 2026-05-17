---
title: "Vue Router ナビゲーションガード完全解説"
date: 2018-02-01 16:46:07
tags:
  - Vue
readingTime: 4
description: "Vue Router のナビゲーションガードはプロジェクトの権限管理の中核ですが、ドキュメントが分散していて混乱しやすいです。この記事ではすべてのガードを整理し、実際のプロジェクトでの使い方を紹介します。"
---

Vue Router のナビゲーションガードはプロジェクトの権限管理の中核ですが、ドキュメントが分散していて混乱しやすいです。この記事ではすべてのガードを整理し、実際のプロジェクトでの使い方を紹介します。

## ガードの分類

Vue Router のガードはスコープによって3種類に分かれます：

- **グローバルガード**：すべてのルートに適用
- **ルート固有のガード**：ルート設定に定義し、そのルートにのみ適用
- **コンポーネント内ガード**：コンポーネント内に定義し、そのコンポーネントの入退出を感知

## グローバルガード

### beforeEach

最もよく使われるガード — すべてのルート遷移の前に発火します：

```javascript
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");

  // ホワイトリスト：ログイン不要なページ
  const whiteList = ["/login", "/register", "/about"];

  if (whiteList.includes(to.path)) {
    next();
    return;
  }

  if (!token) {
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  next();
});
```

注意：**必ず `next()` を呼び出す必要があります** — 呼び忘れるとルーティングが止まってしまいます。これが最もよくある落とし穴です。

### afterEach

ナビゲーション完了後に発火し、`next` 引数を受け取りません：

```javascript
router.afterEach((to, from) => {
  // ページタイトルを変更
  document.title = to.meta.title || "私のアプリ";

  // PV を上報
  analytics.trackPageView(to.path);
});
```

### beforeResolve

すべてのコンポーネント内ガードと非同期ルートコンポーネントが解決された後、ナビゲーションが確認される前に発火します。あまり使われませんが、コンポーネントが完全にロードされた後に何かを実行する必要がある場合に役立ちます。

## ルート固有のガード

ルート設定に直接書きます：

```javascript
const routes = [
  {
    path: "/admin",
    component: AdminPanel,
    beforeEnter: (to, from, next) => {
      const user = store.getters.currentUser;
      if (!user || user.role !== "admin") {
        next("/403");
        return;
      }
      next();
    },
  },
];
```

この方法は、特定のルートに特別な権限ロジックがあり、グローバルガードを汚染したくない場合に適しています。

## コンポーネント内ガード

### beforeRouteEnter

コンポーネントに入る前に発火 — **この時点ではコンポーネントインスタンスはまだ作成されていない**ため、`this` は使えません：

```javascript
export default {
  beforeRouteEnter(to, from, next) {
    // ここでは this が使えない
    // next のコールバックでインスタンスを取得する
    next((vm) => {
      vm.fetchData(to.params.id);
    });
  },
};
```

### beforeRouteUpdate

ルートが変わるがコンポーネントが再利用される場合に発火（例：`/user/1` → `/user/2`）：

```javascript
export default {
  beforeRouteUpdate(to, from, next) {
    // ここでは this が使える
    this.userId = to.params.id;
    this.fetchData();
    next();
  },
};
```

このガードを知らない人が多く、動的ルートパラメータが変わってもデータが更新されない原因になります。

### beforeRouteLeave

現在のルートを離れる前に発火 — 未保存のコンテンツがあるページをユーザーが誤って離れるのを防ぐためによく使われます：

```javascript
export default {
  data() {
    return { isDirty: false };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      const confirm = window.confirm(
        "未保存のコンテンツがあります。本当に離れますか？",
      );
      if (!confirm) {
        next(false); // ナビゲーションをキャンセル
        return;
      }
    }
    next();
  },
};
```

## ナビゲーション解決の完全なフロー

```
1. ナビゲーションが発火
2. 離れるコンポーネントの beforeRouteLeave を呼び出す
3. グローバル beforeEach を呼び出す
4. ルート固有の beforeEnter を呼び出す（あれば）
5. 非同期ルートコンポーネントを解決する
6. 入るコンポーネントの beforeRouteEnter を呼び出す
7. グローバル beforeResolve を呼び出す
8. ナビゲーションが確認される
9. グローバル afterEach を呼び出す
10. DOM 更新が発火する
11. beforeRouteEnter の next コールバックを呼び出す
```

この順序を理解すれば、権限ロジックをどこに書けばいいかが明確になります。

## 実際のプロジェクトでの権限管理パターン

```javascript
// ルートの meta フィールドで権限を宣言
const routes = [
  {
    path: "/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true, roles: ["admin", "editor"] },
  },
  {
    path: "/settings",
    component: Settings,
    meta: { requiresAuth: true, roles: ["admin"] },
  },
];

// グローバルガードで一括処理
router.beforeEach((to, from, next) => {
  if (!to.meta.requiresAuth) {
    next();
    return;
  }

  const user = store.getters.user;
  if (!user) {
    next("/login");
    return;
  }

  const requiredRoles = to.meta.roles;
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    next("/403");
    return;
  }

  next();
});
```

このパターンでは権限の宣言をルート設定に置き、ガードは一括チェックのみを担当するため、保守しやすいです。

## まとめ

- `beforeEach` は権限チェックの主戦場
- `beforeRouteUpdate` は動的ルートパラメータ変更時にデータが更新されない問題を解決する
- `beforeRouteLeave` はユーザーが未保存データを誤って失うのを防ぐ
- `next()` は必ず呼び出す — 忘れるとアプリ全体が止まる
