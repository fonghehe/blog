---
title: "Vue keep-alive ルートキャッシュ"
date: 2018-02-18 10:12:01
tags:
  - Vue
readingTime: 2
description: "管理画面でよくある要件があります：一覧ページから詳細ページに遷移して戻ったとき、一覧ページのスクロール位置とフィルター状態を保持したい。`keep-alive` はまさにこの問題を解決します。"
---

管理画面でよくある要件があります：一覧ページから詳細ページに遷移して戻ったとき、一覧ページのスクロール位置とフィルター状態を保持したい。`keep-alive` はまさにこの問題を解決します。

## 基本的な使い方

```html
<!-- App.vue -->
<template>
  <div id="app">
    <keep-alive>
      <router-view />
    </keep-alive>
  </div>
</template>
```

`keep-alive` を追加すると、ルートコンポーネントはルート切替時に破棄されずキャッシュされ、再度遷移したときに再利用されます。

## 一部のルートのみキャッシュ

多くの場合、すべてのルートをキャッシュしたいわけではなく、特定のものだけキャッシュしたいです。

**方法 1：include/exclude**

```html
<!-- UserList と OrderList のみキャッシュ -->
<keep-alive :include="['UserList', 'OrderList']">
  <router-view />
</keep-alive>
```

```javascript
// コンポーネントに name を設定する必要がある
export default {
  name: "UserList", // include 内の名前と一致する必要がある
};
```

**方法 2：ルートの meta 設定（推奨）**

```javascript
// router.js
const routes = [
  {
    path: "/users",
    component: UserList,
    meta: { keepAlive: true }, // このルートをキャッシュ
  },
  {
    path: "/users/:id",
    component: UserDetail,
    meta: { keepAlive: false }, // キャッシュしない
  },
];
```

```html
<!-- App.vue -->
<keep-alive>
  <router-view v-if="$route.meta.keepAlive" />
</keep-alive>
<router-view v-if="!$route.meta.keepAlive" />
```

## activated と deactivated

`keep-alive` でキャッシュされたコンポーネントには2つの追加ライフサイクルフックがあります：

```javascript
export default {
  name: "UserList",
  activated() {
    // コンポーネントが「アクティブ化」されるたびに発火（最初の mount 後を含む）
    // 適した用途：詳細ページから戻ったときにデータを更新する
    console.log("UserList がアクティブ化されました");
    this.refreshIfNeeded();
  },
  deactivated() {
    // コンポーネントが「非アクティブ化」されるときに発火（破棄されずに切り替え）
    console.log("UserList が非アクティブ化されました");
  },
};
```

注意：キャッシュされたコンポーネントは再度進入した際に `created` と `mounted` は**発火しません** — `activated` のみ発火します。

## 実際のプロジェクトでのスクロール位置の復元

```javascript
export default {
  name: "UserList",
  data() {
    return {
      scrollTop: 0,
    };
  },
  activated() {
    // スクロール位置を復元
    this.$nextTick(() => {
      document.documentElement.scrollTop = this.scrollTop;
    });
  },
  deactivated() {
    // 離れるときのスクロール位置を保存
    this.scrollTop = document.documentElement.scrollTop;
  },
};
```

## まとめ

- `keep-alive` はルートコンポーネントをキャッシュして、繰り返しの破棄・生成を避ける
- ルートの meta の `keepAlive` フィールドでどのルートをキャッシュするか制御する
- キャッシュされたコンポーネントは `mounted`/`beforeDestroy` の代わりに `activated`/`deactivated` を使う
- 適したシナリオ：戻ったときの一覧ページの状態保持、タブ切替でのリセット防止
