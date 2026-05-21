---
title: "Vue 异步组件与动态组件"
date: 2018-05-08 10:58:42
tags:
  - Vue
readingTime: 2
description: "组件懒加载是减小首屏 bundle 体积的重要手段。Vue 提供了异步组件和动态组件两种机制，理清它们的区别和用法。"
wordCount: 296
---

组件懒加载是减小首屏 bundle 体积的重要手段。Vue 提供了异步组件和动态组件两种机制，理清它们的区别和用法。

## 异步组件

Vue 支持把组件定义为一个返回 Promise 的函数：

```javascript
// 方式一：简单工厂函数
const AsyncComponent = () => import("./HeavyComponent.vue");

// 方式二：带配置的高级写法（Vue 2.3+）
const AsyncComponent = () => ({
  component: import("./HeavyComponent.vue"), // 要加载的组件
  loading: LoadingSpinner, // 加载中显示
  error: ErrorFallback, // 加载失败显示
  delay: 200, // 200ms 后才显示 loading（避免闪烁）
  timeout: 10000, // 超时时间
});
```

### 路由懒加载

最常见的使用场景：

```javascript
const routes = [
  {
    path: "/dashboard",
    component: () => import("@/views/Dashboard.vue"),
  },
  {
    path: "/users",
    // webpackChunkName 控制打包到同一个 chunk
    component: () => import(/* webpackChunkName: "user" */ "@/views/Users.vue"),
  },
  {
    path: "/users/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "@/views/UserDetail.vue"),
  },
];
```

用户访问 `/users` 时才下载 `user.[hash].js`，首屏不需要加载这些代码。

### 条件渲染异步组件

```vue
<template>
  <div>
    <button @click="showEditor = true">打开编辑器</button>

    <!-- 只有点击后才加载富文本编辑器（体积通常很大）-->
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

## 动态组件

用 `<component :is="xxx">` 实现运行时切换组件：

```vue
<template>
  <div>
    <button @click="current = 'TabA'">Tab A</button>
    <button @click="current = 'TabB'">Tab B</button>
    <button @click="current = 'TabC'">Tab C</button>

    <!-- is 可以是组件名字符串或组件对象 -->
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

### keep-alive 缓存状态

切换组件时默认会销毁上一个，重新创建新的。用 `<keep-alive>` 保留组件状态：

```vue
<keep-alive>
  <component :is="current" />
</keep-alive>
```

被 `keep-alive` 的组件不会触发 `created`/`destroyed`，而是触发：

- `activated`：组件被激活（从缓存中取出）
- `deactivated`：组件被停用（进入缓存）

```javascript
export default {
  activated() {
    // 组件重新出现，可能需要刷新数据
    this.refreshData();
  },
  deactivated() {
    // 组件被缓存，可以做一些清理
  },
};
```

### 动态组件 + 异步加载

两者可以结合：

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

## 异步组件的加载状态

```vue
<template>
  <Suspense>
    <!-- 加载中 -->
    <template #fallback>
      <el-skeleton :rows="5" animated />
    </template>
  </Suspense>
</template>
```

Vue 2 没有 `Suspense`，用高级异步组件配置实现：

```javascript
const AsyncChart = () => ({
  component: import("./HeavyChart.vue"),
  loading: {
    template: '<el-skeleton :rows="5" animated />',
  },
  error: {
    template: '<el-empty description="加载失败" />',
  },
  delay: 300,
  timeout: 8000,
});
```

## 小结

- 路由组件用 `() => import()` 实现懒加载，减少首屏体积
- `webpackChunkName` 把相关路由合并成一个 chunk
- `<component :is>` 实现动态切换，配合 `<keep-alive>` 保留状态
- `keep-alive` 组件用 `activated`/`deactivated` 代替 `created`/`destroyed`
