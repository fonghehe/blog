---
title: "Vue 異步組件與動態組件"
date: 2018-05-08 10:58:42
tags:
  - Vue
readingTime: 2
description: "組件懶加載是減小首屏 bundle 體積的重要手段。Vue 提供了異步組件和動態組件兩種機制，理清它們的區別和用法。"
---

組件懶加載是減小首屏 bundle 體積的重要手段。Vue 提供了異步組件和動態組件兩種機制，理清它們的區別和用法。

## 異步組件

Vue 支持把組件定義為一個返回 Promise 的函數：

```javascript
// 方式一：簡單工廠函數
const AsyncComponent = () => import("./HeavyComponent.vue");

// 方式二：帶配置的高級寫法（Vue 2.3+）
const AsyncComponent = () => ({
  component: import("./HeavyComponent.vue"), // 要加載的組件
  loading: LoadingSpinner, // 加載中顯示
  error: ErrorFallback, // 加載失敗顯示
  delay: 200, // 200ms 後才顯示 loading（避免閃爍）
  timeout: 10000, // 超時時間
});
```

### 路由懶加載

最常見的使用場景：

```javascript
const routes = [
  {
    path: "/dashboard",
    component: () => import("@/views/Dashboard.vue"),
  },
  {
    path: "/users",
    // webpackChunkName 控制打包到同一個 chunk
    component: () => import(/* webpackChunkName: "user" */ "@/views/Users.vue"),
  },
  {
    path: "/users/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "@/views/UserDetail.vue"),
  },
];
```

用户訪問 `/users` 時才下載 `user.[hash].js`，首屏不需要加載這些代碼。

### 條件渲染異步組件

```vue
<template>
  <div>
    <button @click="showEditor = true">打開編輯器</button>

    <!-- 只有點擊後才加載富文本編輯器（體積通常很大）-->
    <RichTextEditor v-if="showEditor" content="..." />
  </div>
</template>

<script>
export default {
  components: {
    RichTextEditor: () => import("./RichTextEditor.vue"),
  },
  data() {
    return { showEditor: false };
  },
};
</script>
```

## 動態組件

用 `<component :is="xxx">` 實現運行時切換組件：

```vue
<template>
  <div>
    <button @click="current = 'TabA'">Tab A</button>
    <button @click="current = 'TabB'">Tab B</button>
    <button @click="current = 'TabC'">Tab C</button>

    <!-- is 可以是組件名字符串或組件對象 -->
    <component :is="current" />
  </div>
</template>

<script>
import TabA from "./TabA.vue";
import TabB from "./TabB.vue";
import TabC from "./TabC.vue";

export default {
  components: { TabA, TabB, TabC },
  data() {
    return { current: "TabA" };
  },
};
</script>
```

### keep-alive 緩存狀態

切換組件時默認會銷燬上一個，重新創建新的。用 `<keep-alive>` 保留組件狀態：

```vue
<keep-alive>
  <component :is="current" />
</keep-alive>
```

被 `keep-alive` 的組件不會觸發 `created`/`destroyed`，而是觸發：

- `activated`：組件被激活（從緩存中取出）
- `deactivated`：組件被停用（進入緩存）

```javascript
export default {
  activated() {
    // 組件重新出現，可能需要刷新數據
    this.refreshData();
  },
  deactivated() {
    // 組件被緩存，可以做一些清理
  },
};
```

### 動態組件 + 異步加載

兩者可以結合：

```javascript
const componentMap = {
  bar: () => import("./BarChart.vue"),
  line: () => import("./LineChart.vue"),
  pie: () => import("./PieChart.vue"),
};

export default {
  computed: {
    currentChart() {
      return componentMap[this.chartType];
    },
  },
};
```

```vue
<keep-alive>
  <component :is="currentChart" :data="chartData" />
</keep-alive>
```

## 異步組件的加載狀態

```vue
<template>
  <Suspense>
    <!-- 加載中 -->
    <template #fallback>
      <el-skeleton :rows="5" animated />
    </template>
  </Suspense>
</template>
```

Vue 2 沒有 `Suspense`，用高級異步組件配置實現：

```javascript
const AsyncChart = () => ({
  component: import("./HeavyChart.vue"),
  loading: {
    template: '<el-skeleton :rows="5" animated />',
  },
  error: {
    template: '<el-empty description="加載失敗" />',
  },
  delay: 300,
  timeout: 8000,
});
```

## 小結

- 路由組件用 `() => import()` 實現懶加載，減少首屏體積
- `webpackChunkName` 把相關路由合併成一個 chunk
- `<component :is>` 實現動態切換，配合 `<keep-alive>` 保留狀態
- `keep-alive` 組件用 `activated`/`deactivated` 代替 `created`/`destroyed`
