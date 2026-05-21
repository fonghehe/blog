---
title: "Vue 非同步元件與動態元件"
date: 2018-05-08 10:58:42
tags:
  - Vue
readingTime: 2
description: "元件懶載入是減小首屏 bundle 體積的重要手段。Vue 提供了非同步元件和動態元件兩種機制，理清它們的區別和用法。"
wordCount: 304
---

元件懶載入是減小首屏 bundle 體積的重要手段。Vue 提供了非同步元件和動態元件兩種機制，理清它們的區別和用法。

## 非同步元件

Vue 支援把元件定義為一個返回 Promise 的函式：

```javascript
// 方式一：簡單工廠函式
const AsyncComponent = () => import("./HeavyComponent.vue");

// 方式二：帶配置的高階寫法（Vue 2.3+）
const AsyncComponent = () => ({
  component: import("./HeavyComponent.vue"), // 要載入的元件
  loading: LoadingSpinner, // 載入中顯示
  error: ErrorFallback, // 載入失敗顯示
  delay: 200, // 200ms 後才顯示 loading（避免閃爍）
  timeout: 10000, // 超時時間
});
```

### 路由懶載入

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

使用者訪問 `/users` 時才下載 `user.[hash].js`，首屏不需要載入這些程式碼。

### 條件渲染非同步元件

```vue
<template>
  <div>
    <button @click="showEditor = true">開啟編輯器</button>

    <!-- 只有點選後才載入富文本編輯器（體積通常很大）-->
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

## 動態元件

用 `<component :is="xxx">` 實現執行時切換元件：

```vue
<template>
  <div>
    <button @click="current = 'TabA'">Tab A</button>
    <button @click="current = 'TabB'">Tab B</button>
    <button @click="current = 'TabC'">Tab C</button>

    <!-- is 可以是元件名字串或元件物件 -->
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

### keep-alive 快取狀態

切換元件時預設會銷燬上一個，重新建立新的。用 `<keep-alive>` 保留元件狀態：

```vue
<keep-alive>
  <component :is="current" />
</keep-alive>
```

被 `keep-alive` 的元件不會觸發 `created`/`destroyed`，而是觸發：

- `activated`：元件被啟用（從快取中取出）
- `deactivated`：元件被停用（進入快取）

```javascript
export default {
  activated() {
    // 元件重新出現，可能需要重新整理資料
    this.refreshData();
  },
  deactivated() {
    // 元件被快取，可以做一些清理
  },
};
```

### 動態元件 + 非同步載入

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

## 非同步元件的載入狀態

```vue
<template>
  <Suspense>
    <!-- 載入中 -->
    <template #fallback>
      <el-skeleton :rows="5" animated />
    </template>
  </Suspense>
</template>
```

Vue 2 沒有 `Suspense`，用高階非同步元件配置實現：

```javascript
const AsyncChart = () => ({
  component: import("./HeavyChart.vue"),
  loading: {
    template: '<el-skeleton :rows="5" animated />',
  },
  error: {
    template: '<el-empty description="載入失敗" />',
  },
  delay: 300,
  timeout: 8000,
});
```

## 小結

- 路由元件用 `() => import()` 實現懶載入，減少首屏體積
- `webpackChunkName` 把相關路由合併成一個 chunk
- `<component :is>` 實現動態切換，配合 `<keep-alive>` 保留狀態
- `keep-alive` 元件用 `activated`/`deactivated` 代替 `created`/`destroyed`
