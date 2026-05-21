---
title: "Webpack 5 Module Federation in Practice"
date: 2020-07-13 10:23:25
tags:
  - Webpack
  - Engineering
readingTime: 4
description: "Webpack 5 还在 beta 阶段，但 Module Federation 这个特性已经让团队非常兴奋了。简单说，它允许独立构建的应用之间在运行时共享模块——这解决的是微前端场景中最头疼的问题：跨应用共享组件和依赖。"
wordCount: 533
---

Webpack 5 还在 beta 阶段，但 Module Federation 这个特性已经让团队非常兴奋了。简单说，它允许独立构建的应用之间在运行时共享模块——这解决的是微前端场景中最头疼的问题：跨应用共享组件和依赖。

## Pain Points of Traditional Approaches

之前做微前端，如果多个应用都要用同一个公共组件库，要么每个应用都打包一份（体积爆炸），要么用 externals + CDN（版本管理困难）。Module Federation 从根本上解决了这个问题。

## Core Concepts

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

### 4. TypeScript 类型声明

远程模块没有本地类型，需要手动声明：

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

`shared` 是 Module Federation 最关键的配置之一。如果配不好，要么依赖重复加载，要么出现 Vue 多实例导致响应式系统混乱：

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

- `singleton: true` —— 对 Vue/React 这类有全局状态的库必须开启
- `eager: true` —— 如果你的入口是同步的且需要立即使用共享库，开启它避免加载顺序问题
- `strictVersion` —— 生产环境建议开启，开发环境关闭方便调试

## Runtime Loading Process

```
浏览器访问 localhost:3000
  -> shell 应用加载
  -> 解析 remoteEntry.js (product_components, user_center)
  -> 加载共享依赖 (vue 只加载一份)
  -> 按需加载远程模块
```

第一次访问会有一定延迟（需要加载 remoteEntry.js 和共享依赖），后续切换页面时远程模块已被缓存，体验很好。

## Summary

- Module Federation 允许独立构建的应用在运行时共享模块，是微前端的利器
- Host 消费模块，Remote 提供模块，Shared 管理共享依赖
- 共享依赖建议开启 `singleton` 避免框架多实例
- 远程模块的 TypeScript 类型需要手动声明
- Webpack 5 目前还是 beta，生产使用需要评估稳定性
- 相比 iframe、qiankun 等方案，Module Federation 粒度更细、性能更好
