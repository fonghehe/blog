---
title: "Nuxt.js サーバーサイドレンダリング入門：なぜ SSR が必要か"
date: 2018-02-08 09:53:07
tags:
  - Vue
readingTime: 4
description: "最近、SEO が必要なプロジェクトで Nuxt.js を使いました。SSR の基本的な概念と Nuxt のコア使用法をまとめます。"
---

最近、SEO が必要なプロジェクトで Nuxt.js を使いました。SSR の基本的な概念と Nuxt のコア使用法をまとめます。

## なぜ SSR が必要か

標準的な Vue SPA の動作：

```
ブラウザがページをリクエスト
→ サーバーが空の HTML を返す（<div id="app"></div> のみ）
→ ブラウザが JS バンドルをダウンロード
→ Vue がクライアント側でレンダリングしてコンテンツを埋める
→ ユーザーがページを見る
```

これにより 2 つの問題が生じます：

1. **SEO が悪い**：検索エンジンのクローラーは空の HTML を受け取り、コンテンツを見ることができない
2. **初期表示が遅い**：JS がダウンロードされて実行されるまでユーザーはコンテンツを見られない

SSR ソリューション：

```
ブラウザがページをリクエスト
→ サーバーが Vue を実行して完全な HTML を生成
→ コンテンツのある HTML を返す
→ ユーザーが即座にページを見る（初期表示が速い）
→ JS がロードされ、Vue が引き継ぐ（ハイドレーション）
→ ページが通常の SPA になる
```

## Nuxt.js とは

Nuxt.js は Vue ベースの SSR フレームワークで、SSR の複雑な設定の問題を解決します：

- 自動ルーティング（ファイル構造ベース）
- Vuex の組み込み統合
- 自動コード分割
- 静的サイト生成（SSG）サポート

## プロジェクト構造

```
nuxt-app/
├── pages/          ← ページコンポーネント、自動的にルートを生成
│   ├── index.vue   → /
│   ├── about.vue   → /about
│   └── users/
│       └── _id.vue → /users/:id
├── layouts/        ← レイアウトテンプレート
│   └── default.vue
├── components/     ← 通常のコンポーネント
├── store/          ← Vuex ストア
├── static/         ← 静的ファイル
├── assets/         ← 処理が必要なアセット
└── nuxt.config.js  ← 設定ファイル
```

## コアコンセプト：asyncData

サーバー側でデータを取得するための重要な SSR フック：

```vue
{% raw %}
<template>
  <div>
    <h1>{{ post.title }}</h1>
    <p>{{ post.content }}</p>
  </div>
</template>

<script>
import axios from "axios";

export default {
  async asyncData({ params, error }) {
    try {
      const { data } = await axios.get(`/api/posts/${params.id}`);
      return { post: data };
    } catch (e) {
      error({ statusCode: 404, message: "記事が見つかりません" });
    }
  },
};
</script>
{% endraw %}
```

`asyncData` はサーバー側で実行され、返されたデータは `data()` にマージされます。ページの HTML にはすでにこのデータが含まれているので、検索エンジンがインデックスできます。

注意：`asyncData` 内では **`this` を使用できません**（コンポーネントがまだインスタンス化されていない）。ルート情報やストアなどには `context` 引数を使います。

## fetch フック

`fetch` もサーバー側で実行されますが、Vuex ストアの充填に使われます：

```vue
<script>
export default {
  async fetch({ store, params }) {
    await store.dispatch("posts/fetchPost", params.id);
  },
};
</script>
```

## 動的ルーティング

ファイル名の `_` プレフィックスで動的パラメータを表します：

```
pages/
├── users/
│   ├── index.vue      → /users
│   └── _id.vue        → /users/:id（動的）
```

```vue
<!-- pages/users/_id.vue -->
<script>
export default {
  async asyncData({ params }) {
    const userId = params.id;
    // ...
  },
};
</script>
```

## nuxt.config.js のよく使う設定

```javascript
module.exports = {
  // ページ head 設定
  head: {
    title: "私のサイト",
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "サイトの説明" },
    ],
  },

  // グローバル CSS
  css: ["~/assets/main.scss"],

  // プラグイン
  plugins: ["~/plugins/axios"],

  // Nuxt モジュール
  modules: ["@nuxtjs/axios"],

  // ビルド設定
  build: {
    extend(config, ctx) {
      // カスタム webpack 設定
    },
  },
};
```

## 静的サイト生成（generate）

本当の SSR が不要で静的 HTML だけ生成したい場合（ブログなど）：

```bash
npm run generate
```

Nuxt はビルド時にすべてのページをリクエストして静的 HTML ファイルを生成し、CDN にデプロイできます。

```javascript
// nuxt.config.js - 動的ルートの静的生成には宣言が必要
module.exports = {
  generate: {
    routes: async () => {
      const { data } = await axios.get("/api/posts");
      return data.map((post) => `/posts/${post.id}`);
    },
  },
};
```

## 落とし穴：window is not defined

SSR 環境（Node.js）では `window` オブジェクトが存在しないため、直接使うとエラーになります：

```javascript
// ❌ サーバーでエラーになる
mounted() {
  // mounted はクライアントのみで実行されるので、ここは安全 ✅
  window.addEventListener('resize', this.handleResize)
}

// ❌ エラーになる
asyncData() {
  const width = window.innerWidth  // サーバーに window がない！
}
```

クライアントでのみ使えるライブラリ（DOM 操作するものなど）の場合：

```javascript
// nuxt.config.js
plugins: [
  { src: "~/plugins/some-plugin", ssr: false }, // クライアントのみ
];
```

## まとめ

Nuxt.js は SSR の複雑さをうまくカプセル化しており、規約ベースのファイルルーティングで素早く開始できます。`asyncData` がコアであり、サーバーとクライアントの両方で実行されるという特性を理解することが重要です。SEO が必要なコンテンツサイトやEC サイトのトップページに適しています。
