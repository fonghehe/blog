---
title: "Vue 2 企業級項目效能優化實戰：實踐方法與治理思路"
date: 2020-01-14 10:09:53
tags:
  - Vue
readingTime: 2
description: "管理後臺項目隨着業務增長，首屏加載從 3 秒飆到 12 秒，頁面切換也開始卡頓。系統梳理了一套 Vue 2 項目的效能優化方案，記錄下來。"
wordCount: 230
---

管理後臺項目隨着業務增長，首屏加載從 3 秒飆到 12 秒，頁面切換也開始卡頓。系統梳理了一套 Vue 2 項目的效能優化方案，記錄下來。

## 路由懶加載

最常見的優化手段，但細節值得注意：

```javascript
// router/index.js
// 基礎寫法
const User = () => import('@/views/User.vue');

// 分組 + 預加載
const User = () => import(
  /* webpackChunkName: "user" */
  /* webpackPrefetch: true */
  '@/views/User.vue'
);

// 按模塊分 chunk
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

效果：首屏 JS 從 1.2MB 降到 300KB。

## 組件級優化

```vue
<template>
  <!-- 大列表：虛擬滾動 -->
  <virtual-list
    :data="tableData"
    :item-height="48"
    :visible-count="20"
  />

  <!-- 重型組件：按條件渲染 + v-if -->
  <chart-panel v-if="showChart" :data="chartData" />
</template>

<script>
export default {
  // 關鍵組件：禁止複用
  name: 'HeavyTable',

  // 列表項組件：用 key 精確匹配
  // 避免就地複用導致的渲染錯亂

  // 計算屬性替代方法（自動緩存）
  computed: {
    filteredList() {
      return this.list.filter(item => item.status === this.filter);
    },
  },

  // 大列表項優化
  methods: {
    // 避免在模板裏用箭頭函數創建新函數
    handleRowClick(row) {
      this.$emit('select', row);
    },
  },
};
</script>
```

## Vuex 優化

```javascript
// store/modules/table.js
const state = {
  list: [],
  total: 0,
  loading: false,
};

const getters = {
  // 緩存派生數據，避免每次重新計算
  activeList: (state) => state.list.filter(item => item.status === 'active'),

  // 分頁數據
  pageData: (state) => (page, pageSize) => {
    const start = (page - 1) * pageSize;
    return state.list.slice(start, start + pageSize);
  },
};

// mutations 隻做數據更新，異步操作放 actions
const mutations = {
  SET_LIST(state, { list, total }) {
    // 一次性替換，避免逐個 push 觸發多次響應式
    state.list = Object.freeze(list); // freeze 避免深層響應式
    state.total = total;
  },
};
```

## Webpack 打包優化

```javascript
// vue.config.js
module.exports = {
  productionSourceMap: false, // 關掉 sourceMap

  configureWebpack: {
    // 分包策略
    optimization: {
      splitChunks: {
        cacheGroups: {
          // Vue 全家桶單獨打包（變更少，長期緩存）
          vue: {
            test: /[\\/]node_modules[\\/](vue|vue-router|vuex)/,
            name: 'vue-vendor',
            chunks: 'all',
            priority: 20,
          },
          // Element UI 單獨打包
          elementUI: {
            test: /[\\/]node_modules[\\/]element-ui/,
            name: 'element-ui',
            chunks: 'all',
            priority: 15,
          },
          // 其他第三方庫
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
    // 圖片壓縮
    config.module
      .rule('images')
      .test(/\.(png|jpe?g|gif|webp)$/)
      .use('image-webpack-loader')
      .loader('image-webpack-loader')
      .options({ bypassOnDev: true });
  },
};
```

## 介面與數據層

```javascript
// 防止重複請求
const pending = new Map();

function generateKey(config) {
  return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
}

axios.interceptors.request.use(config => {
  const key = generateKey(config);
  if (pending.has(key)) {
    pending.get(key)('取消重複請求');
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

## 優化結果

| 指標 | 優化前 | 優化後 |
|
------|--------|--------|
| 首屏加載 | 12s | 2.8s |
| JS 體積 | 1.2MB | 320KB (gzip: 98KB) |
| 首次可交互 | 15s | 3.5s |

## 小結

- 路由懶加載是最基礎也是效果最明顯的優化
- `Object.freeze` 避免大型數據對象的深層響應式開銷
- Webpack splitChunks 按業務/依賴分包，利用瀏覽器緩存
- 請求層面做好防重複和取消機製
- 優先優化首屏相關的資源，非關鍵資源延後加載
