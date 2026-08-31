---
title: "Webpack 5 Module Federation in Practice"
date: 2020-07-13 10:23:25
tags:
  - Webpack
  - Engineering
readingTime: 4
description: "Webpack 5 is still in beta, but the Module Federation feature already has the team excited. In short, it lets independently built applications share modules at runtime — solving the most painful problem in micro-frontends: sharing components and dependencies across apps."
wordCount: 354
---

Webpack 5 is still in beta, but the Module Federation feature already has the team excited. In short, it lets independently built applications share modules at runtime — solving the most painful problem in micro-frontends: sharing components and dependencies across apps.

## Pain Points of Traditional Approaches

Before Module Federation, if multiple apps all needed the same shared component library, you either bundled a copy into each app (bloated size) or used externals + CDN (hard version management). Module Federation solves this at the root.

## Core Concepts

- **Host**: the app that consumes remote modules
- **Remote**: the app that provides modules
- **Shared**: cross-app shared dependencies (e.g. vue, react)

## Walkthrough: Splitting a Product Detail Page

Suppose we have a host app `shell` that consumes a product component library `product-components` and a user center `user-center`.

### 1. Product Component Library (Remote)

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
      'Access-Control-Allow-Origin': '*' // 允许跨域访问
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
        // 暴露的模块路径: 源文件路径
        './ProductCard': './src/components/ProductCard',
        './PriceTag': './src/components/PriceTag',
        './ProductGallery': './src/components/ProductGallery',
        './useProduct': './src/composables/useProduct'
      },
      shared: {
        vue: {
          singleton: true, // 只加载一个实例
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

### 2. User Center (Remote)

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

### 3. Host App

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
        // 声明远程模块的名称和入口地址
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

// 动态导入远程模块
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

### 4. TypeScript Type Declarations

Remote modules have no local types, so you have to declare them manually:

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

## Key shared Configuration Points

`shared` is one of the most critical Module Federation configurations. If set up poorly, you'll either load dependencies twice or end up with multiple Vue instances that break the reactivity system:

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

- `singleton: true` — must be enabled for libraries with global state like Vue/React
- `eager: true` — if your entry point is synchronous and needs the shared library immediately, enable this to avoid loading-order issues
- `strictVersion` — recommended on in production, off in development for easier debugging

## Runtime Loading Process

```
浏览器访问 localhost:3000
  -> shell 应用加载
  -> 解析 remoteEntry.js (product_components, user_center)
  -> 加载共享依赖 (vue 只加载一份)
  -> 按需加载远程模块
```

The first visit incurs some latency (it has to load remoteEntry.js and the shared dependencies), but once you switch pages the remote modules are cached, giving a smooth experience.

## Summary

- Module Federation lets independently built apps share modules at runtime, making it a powerful tool for micro-frontends.
- The host consumes modules, the remote provides them, and shared manages the shared dependencies.
- Enable `singleton` for shared dependencies to avoid multiple framework instances.
- TypeScript types for remote modules must be declared manually.
- Webpack 5 is still in beta, so evaluate its stability before using it in production.
- Compared with approaches like iframes and qiankun, Module Federation offers finer granularity and better performance.
