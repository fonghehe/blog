---
title: "Vue 2 エンタープライズプロジェクトのパフォーマンス最適化実践"
date: 2020-01-14 10:09:53
tags:
  - Vue
readingTime: 3
description: "管理后台项目随着业务增长，首屏加载从 3 秒飙到 12 秒，页面切换也开始卡顿。系统梳理了一套 Vue 2 项目的性能优化方案，记录下来。"
wordCount: 402
---

管理画面のプロジェクトはビジネスの成長とともに、ファーストビュー読み込みが 3 秒から 12 秒に跳ね上がり、ページ切り替えもカクつき始めた。Vue 2 プロジェクトのパフォーマンス最適化の手法を体系立ててまとめ、記録しておく。

## ルートの遅延読み込み

最も一般的な最適化手段だが、細部に注意が必要だ：

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

効果：ファーストビューの JS が 1.2MB から 300KB に減った。

## コンポーネントレベルの最適化

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

## Vuexの最適化

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

## Webpack バンドル最適化

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

## API とデータ層

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

## 最適化の結果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 首屏加载 | 12s | 2.8s |
| JS 体积 | 1.2MB | 320KB (gzip: 98KB) |
| 首次可交互 | 15s | 3.5s |

## まとめ

- ルーティングの遅延読み込みは最も基本的で、効果も最も目に見える最適化だ
- `Object.freeze` で大きなデータオブジェクトの深いリアクティブ化のオーバーヘッドを避ける
- Webpack の splitChunks でビジネス／依存ごとにチャンクを分け、ブラウザキャッシュを活かす
- リクエスト層では重複の防止とキャンセル機構を用意する
- ファーストビューに関連するリソースを優先して最適化し、重要でないリソースは後回しにする
