---
title: "Nuxt.jsサーバーサイドレンダリング実践"
date: 2019-08-29 09:40:58
tags:
  - Vue
readingTime: 2
description: "EC サイトを構築するにあたり、SEO と初回表示速度が要求されました。Nuxt.js を調査した結果、Vue SSR として採用することにしました。"
wordCount: 406
---

EC サイトを構築し、SEO と初回表示速度が要求されました。Nuxt.js を調査した結果、最終的に Vue SSR として採用しました。

## Nuxt.jsとは

Next.js は React に対応し、Nuxt.js は Vue に対応します。提供する機能：

- 規約ベースのルーティング（ファイルがそのままルート）
- サーバーサイドレンダリング（SSR）
- 静的サイト生成（SSG）
- 自動コード分割

## プロジェクト構造

```
pages/
  index.vue          → /
  products/
    index.vue        → /products
    _id.vue          → /products/:id（動的ルーティング）
  about.vue          → /about
layouts/
  default.vue        → デフォルトレイアウト
  admin.vue          → 管理画面レイアウト
components/
store/
  index.js           → Vuex
nuxt.config.js       → 設定ファイル
```

## データ取得

```vue
{% raw %}
<!-- pages/products/_id.vue -->
<template>
  <div>
    <h1>{{ product.name }}</h1>
    <p>{{ product.description }}</p>
    <p>価格：¥{{ product.price }}</p>
  </div>
</template>

<script>
export default {
  // asyncData：サーバーサイドで実行され、データは直接 data にマージされる
  async asyncData({ params, $axios, error }) {
    try {
      const product = await $axios.$get(`/api/products/${params.id}`);
      return { product };
    } catch (e) {
      error({ statusCode: 404, message: "商品が存在しません" });
    }
  },

  // fetch：より柔軟で、Vuex store を更新できる
  async fetch() {
    await this.$store.dispatch("cart/loadCartItems");
  },

  // head：ページの meta タグを設定（SEO に重要！）
  head() {
    return {
      title: this.product.name,
      meta: [
        {
          hid: "description",
          name: "description",
          content: this.product.description,
        },
        { property: "og:title", content: this.product.name },
        { property: "og:image", content: this.product.image },
      ],
    };
  },
};
</script>
{% endraw %}
```

## nuxt.config.jsの主要設定

```javascript
export default {
  mode: "universal", // SSR モード（'spa' は純粋なクライアントサイド）

  // グローバル CSS
  css: ["~/assets/styles/main.scss"],

  // プラグイン（クライアント/サーバーを区別）
  plugins: [
    "~/plugins/axios.js",
    { src: "~/plugins/chart.js", mode: "client" }, // クライアントサイドでのみ読み込む
  ],

  // モジュール
  modules: [
    "@nuxtjs/axios",
    "@nuxtjs/pwa", // PWA サポート
  ],

  // axios 基本設定
  axios: {
    baseURL: process.env.API_URL || "http://localhost:3000",
  },

  // ビルド最適化
  build: {
    extractCSS: true, // CSS を個別に抽出（キャッシュ効率向上）
    optimizeCSS: true,
    babel: {
      plugins: ["lodash"], // lodash tree-shaking
    },
  },

  // レンダリング最適化
  render: {
    bundleRenderer: {
      shouldPreload: (file, type) => {
        return ["script", "style", "font"].includes(type);
      },
    },
  },
};
```

## 静的生成（SEO + CDN）

```javascript
// nuxt.config.js
export default {
  generate: {
    // 動的ルーティング：Nuxt に生成するページを指定
    routes: async () => {
      const products = await axios.get("/api/products?all=true");
      return products.data.map((p) => `/products/${p.id}`);
    },
  },
};
```

```bash
npm run generate  # 静的 HTML を dist/ に生成
# 直接 CDN にアップロード、非常に高速
```

## デプロイ

```dockerfile
# Dockerfile（SSR モード）
FROM node:12-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## よくある落とし穴

1. **window is not defined**：SSR 環境には `window` がないため、`process.client` で判定する
2. **サードパーティライブラリが SSR をサポートしていない**：`mode: 'client'` プラグインまたは動的インポートを使用する
3. **cookies**：サーバーサイドのリクエストで cookie を転送する必要があり、`@nuxtjs/proxy` でクロスドメインを解決する

## まとめ

- `asyncData` はサーバーサイドで実行され、返されたデータは data にマージされて直接レンダリングに使用されます
- 動的ルーティング `_id.vue` は `:id` パラメータに対応します
- `head()` メソッドで SEO meta タグを設定します
- 静的生成はコンテンツが頻繁に変わらないページに適し、SSR はリアルタイムデータに適しています
