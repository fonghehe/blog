---
title: "Vue サーバーサイドレンダリング（SSR）の仕組みを深く理解する"
date: 2018-07-10 17:24:31
tags:
  - Vue
readingTime: 3
description: "上半期にNuxt.jsでSSRプロジェクトを作りました。使っている時はスムーズでしたが、問題が発生するとどこから手を付けていいかわかりませんでした。Vue SSRの仕組みを深く調べたので、コアメカニズムをまとめます。"
---

上半期にNuxt.jsでSSRプロジェクトを作りました。使っている時はスムーズでしたが、問題が発生するとどこから手を付けていいかわかりませんでした。Vue SSRの仕組みを深く調べたので、コアメカニズムをまとめます。

## SSRとCSRのレンダリングの違い

**CSR（クライアントサイドレンダリング）：**

```
1. ブラウザがHTMLをリクエスト → サーバーが空のHTMLを返す
2. ブラウザがJSを読み込む → Vueがクライアントで実行
3. VueがVNodeを作成 → diff → DOMをレンダリング
4. ユーザーがコンテンツを見る（初期表示時間 = JS実行時間）
```

**SSR（サーバーサイドレンダリング）：**

```
1. ブラウザがHTMLをリクエスト → サーバーがVueを実行
2. VueがサーバーでHTML文字列を生成 → ブラウザに送信
3. ブラウザがHTMLを表示（ファーストビューがすぐに見える）
4. ブラウザがJSを読み込む → Vueが既存のDOMを「引き継ぐ」（ハイドレーション）
5. ページがインタラクティブなSPAになる
```

## コアAPI：vue-server-renderer

```javascript
{% raw %}
const Vue = require("vue");
const renderer = require("vue-server-renderer").createRenderer();

const app = new Vue({
  template: `<div>Hello, {{ name }}!</div>`,
  data: { name: "World" },
});

renderer.renderToString(app, (err, html) => {
  console.log(html);
  // <div data-server-rendered="true">Hello, World!</div>
});
{% endraw %}
```

`data-server-rendered="true"`マーカーはクライアントのVueに、このDOMがサーバーレンダリングされたもので再利用できることを伝えます。

## クライアントとサーバーのエントリーを分ける理由

SSRアプリには2つのバンドルが必要です：

**サーバーバンドル**（Node.js環境）：

- SSRレンダリングリクエストを処理
- `window`、`document`などのブラウザAPIはない
- 各リクエストが新しいアプリインスタンスを取得（状態汚染を防ぐ）

**クライアントバンドル**（ブラウザ環境）：

- 通常のSPAバンドル
- サーバーレンダリングされたDOMをハイドレーションする責任を持つ
- ルーティング、インタラクションなどを処理

```javascript
// アプリファクトリー関数（毎回新しいインスタンスを返す。状態汚染を防ぐ）
// app.js
import Vue from "vue";
import App from "./App.vue";
import createRouter from "./router";
import createStore from "./store";

export function createApp() {
  const router = createRouter();
  const store = createStore();

  const app = new Vue({
    router,
    store,
    render: (h) => h(App),
  });

  return { app, router, store };
}
```

```javascript
// entry-server.js
import { createApp } from "./app";

export default (context) => {
  return new Promise((resolve, reject) => {
    const { app, router, store } = createApp();

    router.push(context.url);

    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents();
      if (!matchedComponents.length) {
        return reject({ code: 404 });
      }

      // コンポーネントのasyncDataを呼んでデータを取得
      Promise.all(
        matchedComponents.map((component) => {
          if (component.asyncData) {
            return component.asyncData({ store, route: router.currentRoute });
          }
        }),
      )
        .then(() => {
          // storeの状態をHTMLに埋め込む（クライアントの初期化に使用）
          context.state = store.state;
          resolve(app);
        })
        .catch(reject);
    }, reject);
  });
};
```

## ハイドレーション：クライアントの引き継ぎ

クライアント初期化時、VueはサーバーレンダリングされたDOMが仮想DOMと一致するか確認します。一致すれば再作成せずに再利用します：

```javascript
// entry-client.js
import { createApp } from "./app";

const { app, router, store } = createApp();

// サーバーに埋め込まれた状態でstoreを初期化
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__);
}

router.onReady(() => {
  app.$mount("#app"); // 既存のDOMにマウント。ハイドレーションを開始
});
```

## よくある問題

### 1. SSRでwindow/documentを使う

```javascript
// ❌ サーバーにはwindowがない
if (window.innerWidth < 768) { ... }

// ✅ 実行環境を確認する
if (typeof window !== 'undefined') {
  // ブラウザでのみ実行
}

// ✅ またはmountedに置く（クライアントでのみ実行）
mounted() {
  if (window.innerWidth < 768) { ... }
}
```

### 2. ハイドレーションの不一致

サーバーとクライアントのレンダリング結果が一致しないとハイドレーション警告が出ます：

```vue
{% raw %}
<!-- ❌ クライアントの状態に依存するコンテンツ -->
<template>
  <div>{{ Date.now() }}</div>
  <!-- サーバーとクライアントで時刻が異なる -->
</template>

<!-- ✅ 一貫性を確保する -->
<template>
  <div>{{ formattedDate }}</div>
</template>
<script>
export default {
  asyncData({ store }) {
    store.commit("SET_TIMESTAMP", Date.now());
  },
};
</script>
{% endraw %}
```

### 3. サードパーティライブラリの互換性

多くのライブラリはブラウザ環境を前提としており、SSRでエラーになります。対処法：

- 条件チェックでサーバーサイドの実行をスキップ
- `ssr: false`プラグインを使用（Nuxt.js）

## まとめ

- SSRのコア：サーバーでHTML文字列をレンダリング + クライアントでハイドレーション
- アプリはファクトリー関数として書く。各リクエストが独立したインスタンスを持つ
