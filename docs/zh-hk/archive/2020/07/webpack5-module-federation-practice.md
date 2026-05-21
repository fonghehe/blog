---
title: "Webpack 5 Module Federation 實戰"
date: 2020-07-13 10:23:25
tags:
  - Webpack
  - 工程化
readingTime: 4
description: "Webpack 5 還在 beta 階段，但 Module Federation 這個特性已經讓團隊非常興奮了。簡單説，它允許獨立構建的應用之間在運行時共享模塊——這解決的是微前端場景中最頭疼的問題：跨應用共享組件和依賴。"
wordCount: 543
---

Webpack 5 還在 beta 階段，但 Module Federation 這個特性已經讓團隊非常興奮了。簡單説，它允許獨立構建的應用之間在運行時共享模塊——這解決的是微前端場景中最頭疼的問題：跨應用共享組件和依賴。

## 傳統方案的痛點

之前做微前端，如果多個應用都要用同一個公共組件庫，要麼每個應用都打包一份（體積爆炸），要麼用 externals + CDN（版本管理困難）。Module Federation 從根本上解決了這個問題。

## 核心概念

- **Host**：消費遠程模塊的應用
- **Remote**：提供模塊的應用
- **Shared**：跨應用共享的依賴（如 vue、react）

## 實戰：拆分一個商品詳情頁

假設我們有一個主應用 `shell`，需要消費商品組件庫 `product-components` 和用户中心 `user-center`。

### 1. 商品組件庫（Remote）

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
      'Access-Control-Allow-Origin': '*' // 允許跨域訪問
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
        // 暴露的模塊路徑: 源文件路徑
        './ProductCard': './src/components/ProductCard',
        './PriceTag': './src/components/PriceTag',
        './ProductGallery': './src/components/ProductGallery',
        './useProduct': './src/composables/useProduct'
      },
      shared: {
        vue: {
          singleton: true, // 只加載一個實例
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

### 3. 主應用（Host）

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
        // 聲明遠程模塊的名稱和入口地址
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

// 動態導入遠程模塊
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

### 4. TypeScript 類型聲明

遠程模塊沒有本地類型，需要手動聲明：

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

## shared 配置要點

`shared` 是 Module Federation 最關鍵的配置之一。如果配不好，要麼依賴重複加載，要麼出現 Vue 多實例導致響應式系統混亂：

```javascript
shared: {
  vue: {
    singleton: true,        // 強制只加載一份 Vue
    requiredVersion: '^3.0.0',  // 版本範圍要求
    eager: true,            // 啓動時就加載，不走異步
    strictVersion: false    // 版本不匹配時發警告而非報錯
  }
}
```

- `singleton: true` —— 對 Vue/React 這類有全局狀態的庫必須開啓
- `eager: true` —— 如果你的入口是同步的且需要立即使用共享庫，開啓它避免加載順序問題
- `strictVersion` —— 生產環境建議開啓，開發環境關閉方便調試

## 運行時加載流程

```
瀏覽器訪問 localhost:3000
  -> shell 應用加載
  -> 解析 remoteEntry.js (product_components, user_center)
  -> 加載共享依賴 (vue 只加載一份)
  -> 按需加載遠程模塊
```

第一次訪問會有一定延遲（需要加載 remoteEntry.js 和共享依賴），後續切換頁面時遠程模塊已被緩存，體驗很好。

## 小結

- Module Federation 允許獨立構建的應用在運行時共享模塊，是微前端的利器
- Host 消費模塊，Remote 提供模塊，Shared 管理共享依賴
- 共享依賴建議開啓 `singleton` 避免框架多實例
- 遠程模塊的 TypeScript 類型需要手動聲明
- Webpack 5 目前還是 beta，生產使用需要評估穩定性
- 相比 iframe、qiankun 等方案，Module Federation 粒度更細、性能更好
