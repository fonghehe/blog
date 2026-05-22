---
title: "Webpack 5 Module Federation 実践"
date: 2020-07-13 10:23:25
tags:
  - Webpack
  - エンジニアリング
readingTime: 5
description: "Webpack 5 はまだベータ版ですが、Module Federation という機能にはチームがすでに非常に興奮しています。簡単に言えば、独立して構築されたアプリケーション間で実行時にモジュールを共有できるようになります。これにより、マイクロフロントエンドのシナリオで最も厄介な問題である、アプリケーション間でのコンポーネントと依存関係の共有が解決されます。"
wordCount: 971
---

Webpack 5 はまだベータ版ですが、Module Federation という機能はチームを非常に興奮させています。簡単に言うと、独立して構築されたアプリケーション間で実行時にモジュールを共有できるようになります。これにより、マイクロフロントエンドのシナリオで最も厄介な問題である、アプリケーション間でのコンポーネントと依存関係の共有が解決されます。

## 従来の手法の課題

以前マイクロフロントエンドを構築する際、複数のアプリケーションが同じ共通コンポーネントライブラリを使用する場合、各アプリケーションがそれぞれバンドルするか（サイズが爆発的に増加）、externals + CDN を使用するか（バージョン管理が困難）の選択肢しかありませんでした。Module Federation はこの問題を根本的に解決します。

## コアコンセプト

- **Host**：消费远程模块的应用
- **Remote**：提供模块的应用
- **Shared**：跨应用共享的依赖（如 vue、react）

## 实战：拆分一个商品详情页

假设我们有一个主应用 `shell`，需要消费商品组件库 `product-components` 和用户中心 `user-center`。

### 1. 商品组件库（Remote）

```javascript
// product-components/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  devServer: {
    port: 3001,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*' // クロスドメインアクセスを許可
    }
  },
  output: {
    publicPath: 'http://localhost:3001/',
    uniqueName: 'product_components'
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'product_components',
      filename: 'remoteEntry.js',
      exposes: {
        // 公開するモジュールパス: ソースファイルパス
        './ProductCard': './src/components/ProductCard',
        './PriceTag': './src/components/PriceTag',
        './ProductGallery': './src/components/ProductGallery',
        './useProduct': './src/composables/useProduct'
      },
      shared: {
        vue: {
          singleton: true, // インスタンスを1つだけ読み込む
          requiredVersion: '^3.0.0',
          eager: true
        },
        'vue-router': {
          singleton: true,
          requiredVersion: '^4.0.0'
        }
      }
    })
  ]
}
```

```vue
{% raw %}
<!-- product-components/src/components/ProductCard.vue -->
<template>
  <div class="product-card" @click="$emit('select', product)">
    <img :src="product.image" :alt="product.name" loading="lazy" />
    <div class="info">
      <h3>{{ product.name }}</h3>
      <PriceTag :price="product.price" :discount="product.discount" />
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import PriceTag from './PriceTag.vue'

export default defineComponent({
  name: 'ProductCard',
  components: { PriceTag },
  props: {
    product: {
      type: Object,
      required: true
    }
  },
  emits: ['select']
})
</script>
{% endraw %}
```

```typescript
// product-components/src/composables/useProduct.ts
import { ref, Ref } from 'vue'

interface Product {
  id: string
  name: string
  price: number
  discount?: number
  image: string
  description: string
}

export function useProduct(productId: Ref<string>) {
  const product = ref<Product | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function fetchProduct() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/products/${productId.value}`)
      product.value = await res.json()
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  return { product, loading, error, fetchProduct }
}
```

### 2. 用户中心（Remote）

```javascript
// user-center/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  devServer: {
    port: 3002,
    headers: { 'Access-Control-Allow-Origin': '*' }
  },
  output: {
    publicPath: 'http://localhost:3002/'
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'user_center',
      filename: 'remoteEntry.js',
      exposes: {
        './UserAvatar': './src/components/UserAvatar',
        './useAuth': './src/composables/useAuth',
        './FavoriteButton': './src/components/FavoriteButton'
      },
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' }
      }
    })
  ]
}
```

### 3. 主应用（Host）

```javascript
// shell/webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  devServer: {
    port: 3000
  },
  output: {
    publicPath: 'http://localhost:3000/'
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        // リモートモジュールの名前とエントリURLを宣言
        product_components: 'product_components@http://localhost:3001/remoteEntry.js',
        user_center: 'user_center@http://localhost:3002/remoteEntry.js'
      },
      shared: {
        vue: { singleton: true, requiredVersion: '^3.0.0' },
        'vue-router': { singleton: true }
      }
    })
  ]
}
```

```typescript
// shell/src/views/ProductDetail.vue
<template>
  <div class="product-detail">
    <header>
      <UserAvatar />
      <FavoriteButton :product-id="productId" />
    </header>
    <main v-if="!loading && product">
      <ProductGallery :images="product.images" />
      <ProductCard :product="product" />
    </main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// リモートモジュールを動的インポート
const ProductCard = () => import('product_components/ProductCard')
const ProductGallery = () => import('product_components/ProductGallery')
const { useProduct } = await import('product_components/useProduct')
const UserAvatar = () => import('user_center/UserAvatar')
const FavoriteButton = () => import('user_center/FavoriteButton')

export default defineComponent({
  components: {
    ProductCard,
    ProductGallery,
    UserAvatar,
    FavoriteButton
  },
  setup() {
    const route = useRoute()
    const productId = ref(route.params.id as string)
    const { product, loading, fetchProduct } = useProduct(productId)

    watch(productId, fetchProduct, { immediate: true })

    return { productId, product, loading }
  }
})
</script>
```

### 4. TypeScript 类型声明

リモートモジュールにはローカル型定義がありません。手動で宣言する必要があります。

```typescript
// shell/src/types/remote-modules.d.ts
declare module 'product_components/ProductCard' {
  import { DefineComponent } from 'vue'
  const ProductCard: DefineComponent<{ product: object }>
  export default ProductCard
}

declare module 'product_components/ProductGallery' {
  import { DefineComponent } from 'vue'
  const ProductGallery: DefineComponent<{ images: string[] }>
  export default ProductGallery
}

declare module 'product_components/useProduct' {
  import { Ref } from 'vue'
  export function useProduct(productId: Ref<string>): {
    product: Ref<any>
    loading: Ref<boolean>
    error: Ref<Error | null>
    fetchProduct: () => Promise<void>
  }
}

declare module 'user_center/UserAvatar' {
  import { DefineComponent } from 'vue'
  const UserAvatar: DefineComponent
  export default UserAvatar
}

declare module 'user_center/FavoriteButton' {
  import { DefineComponent } from 'vue'
  const FavoriteButton: DefineComponent<{ productId: string }>
  export default FavoriteButton
}
```

## shared 設定のポイント

`shared` は Module Federation の最も重要な設定の1つです。適切に設定しないと、依存関係の重複読み込みや、Vue の複数インスタンスによるリアクティブシステムの混乱が発生する可能性があります。

```javascript
shared: {
  vue: {
    singleton: true,        // 强制只加载一份 Vue
    requiredVersion: '^3.0.0',  // 版本范围要求
    eager: true,            // 启动时就加载，不走异步
    strictVersion: false    // 版本不匹配时发警告而非报错
  }
}
```

- `singleton: true` —— Vue/React のようなグローバル状態を持つライブラリでは必須です
- `eager: true` —— エントリが同期的で共有ライブラリを即座に使用する必要がある場合、読み込み順序の問題を避けるために有効にします
- `strictVersion` —— 本番環境では有効化を推奨、開発環境では無効にしてデバッグを容易にします

## ランタイム読み込みフロー

```
浏览器访问 localhost:3000
  -> shell 应用加载
  -> 解析 remoteEntry.js (product_components, user_center)
  -> 加载共享依赖 (vue 只加载一份)
  -> 按需加载远程模块
```

最初のアクセス時には遅延が発生しますが（remoteEntry.js と共有依存関係の読み込みが必要）、その後のページ遷移ではリモートモジュールがキャッシュされているため、快適な体験が得られます。

## まとめ

- Module Federation は独立して構築されたアプリケーションが実行時にモジュールを共有できるようにする、マイクロフロントエンドの強力なツールです
- Host はモジュールを消費し、Remote はモジュールを提供し、Shared は共有依存関係を管理します
- 共有依存関係ではフレームワークの複数インスタンスを避けるため `singleton` の有効化を推奨します
- リモートモジュールの TypeScript 型定義は手動で宣言する必要があります
- Webpack 5 は現在ベータ版のため、本番利用には安定性の評価が必要です
- iframe や qiankun などの方式と比較して、Module Federation はより細かい粒度と優れたパフォーマンスを提供します
