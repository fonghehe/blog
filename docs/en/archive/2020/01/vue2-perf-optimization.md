---
title: "Vue 2 Enterprise Project Performance Optimization in Practice"
date: 2020-01-14 10:09:53
tags:
  - Vue
readingTime: 2
description: "As our admin dashboard grew, first-screen load time jumped from 3 seconds to 12, and page transitions started to stutter. Here is a systematic set of performance optimization strategies for Vue 2 projects."
wordCount: 149
---

As our admin dashboard grew, first-screen load time jumped from 3 seconds to 12, and page transitions started to stutter. I've put together a set of performance optimization strategies for Vue 2 projects and am recording them here.

## Route Lazy Loading

The most common optimization technique, but the details are worth noting:

```javascript
// router/index.js
// 基础写法
const User = () => import('@/views/User.vue');

// 分组 + 预加载
const User = () => import(
  /* webpackChunkName: "user" */
  /* webpackPrefetch: true */
  '@/views/User.vue'
);

// 按模块分 chunk
const routes = [
  {
    path: '/dashboard',
    component: () => import(/* webpackChunkName: "dashboard" */ '@/views/Dashboard.vue'),
  },
  {
    path: '/system',
    component: () => import(/* webpackChunkName: "system" */ '@/views/System.vue'),
  },
];
```

Result: first-screen JS dropped from 1.2MB to 300KB.

## Component-Level Optimization

```vue
<template>
  <!-- 大列表：虚拟滚动 -->
  <virtual-list
    :data="tableData"
    :item-height="48"
    :visible-count="20"
  />

  <!-- 重型组件：按条件渲染 + v-if -->
  <chart-panel v-if="showChart" :data="chartData" />
</template>

<script>
export default {
  // 关键组件：禁止复用
  name: 'HeavyTable',

  // 列表项组件：用 key 精确匹配
  // 避免就地复用导致的渲染错乱

  // 计算属性替代方法（自动缓存）
  computed: {
    filteredList() {
      return this.list.filter(item => item.status === this.filter);
    },
  },

  // 大列表项优化
  methods: {
    // 避免在模板里用箭头函数创建新函数
    handleRowClick(row) {
      this.$emit('select', row);
    },
  },
};
</script>
```

## Vuex Optimization

```javascript
// store/modules/table.js
const state = {
  list: [],
  total: 0,
  loading: false,
};

const getters = {
  // 缓存派生数据，避免每次重新计算
  activeList: (state) => state.list.filter(item => item.status === 'active'),

  // 分页数据
  pageData: (state) => (page, pageSize) => {
    const start = (page - 1) * pageSize;
    return state.list.slice(start, start + pageSize);
  },
};

// mutations 只做数据更新，异步操作放 actions
const mutations = {
  SET_LIST(state, { list, total }) {
    // 一次性替换，避免逐个 push 触发多次响应式
    state.list = Object.freeze(list); // freeze 避免深层响应式
    state.total = total;
  },
};
```

## Webpack Bundle Optimization

```javascript
// vue.config.js
module.exports = {
  productionSourceMap: false, // 关掉 sourceMap

  configureWebpack: {
    // 分包策略
    optimization: {
      splitChunks: {
        cacheGroups: {
          // Vue 全家桶单独打包（变更少，长期缓存）
          vue: {
            test: /[\\/]node_modules[\\/](vue|vue-router|vuex)/,
            name: 'vue-vendor',
            chunks: 'all',
            priority: 20,
          },
          // Element UI 单独打包
          elementUI: {
            test: /[\\/]node_modules[\\/]element-ui/,
            name: 'element-ui',
            chunks: 'all',
            priority: 15,
          },
          // 其他第三方库
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
        },
      },
    },
  },

  chainWebpack(config) {
    // 图片压缩
    config.module
      .rule('images')
      .test(/\.(png|jpe?g|gif|webp)$/)
      .use('image-webpack-loader')
      .loader('image-webpack-loader')
      .options({ bypassOnDev: true });
  },
};
```

## API and Data Layer

```javascript
// 防止重复请求
const pending = new Map();

function generateKey(config) {
  return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
}

axios.interceptors.request.use(config => {
  const key = generateKey(config);
  if (pending.has(key)) {
    pending.get(key)('取消重复请求');
  }
  config.cancelToken = new axios.CancelToken(cancel => {
    pending.set(key, cancel);
  });
  return config;
});

axios.interceptors.response.use(
  response => {
    const key = generateKey(response.config);
    pending.delete(key);
    return response;
  },
  error => {
    if (!axios.isCancel(error)) {
      pending.delete(generateKey(error.config));
    }
    return Promise.reject(error);
  }
);
```

## Optimization Results

| Metric | Before | After |
|------|--------|--------|
| First-screen load | 12s | 2.8s |
| JS bundle size | 1.2MB | 320KB (gzip: 98KB) |
| Time to interactive | 15s | 3.5s |

## Summary

- Route lazy loading is the most basic optimization and also the most noticeable in impact.
- `Object.freeze` avoids the deep-reactivity overhead of large data objects.
- Webpack's splitChunks splits bundles by business/dependency so the browser cache can be leveraged.
- At the request level, implement de-duplication and cancellation mechanisms.
- Prioritize optimizing first-screen resources, and defer loading of non-critical ones.
