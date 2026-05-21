---
title: "Vue Router 的懒加载和性能优化"
date: 2018-06-30 09:32:13
tags:
  - Vue
readingTime: 2
description: "后台管理系统越来越大，首页加载时间越来越长。用 Vue Router 的懒加载把初始 bundle 拆开，明显感受到了加速。"
wordCount: 256
---

后台管理系统越来越大，首页加载时间越来越长。用 Vue Router 的懒加载把初始 bundle 拆开，明显感受到了加速。

## 什么是路由懒加载

```javascript
// 不用懒加载：所有页面打进一个 bundle
import Home from "./views/Home.vue";
import User from "./views/User.vue";
import Order from "./views/Order.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/user", component: User },
  { path: "/order", component: Order },
];

// 问题：用户进首页，也要下载 User 和 Order 的代码
```

```javascript
// 懒加载：只有访问对应路由时才下载该页面的代码
const routes = [
  {
    path: "/",
    component: () => import("./views/Home.vue"),
  },
  {
    path: "/user",
    component: () => import("./views/User.vue"),
  },
  {
    path: "/order",
    component: () => import("./views/Order.vue"),
  },
];
```

## 分组打包（魔法注释）

默认情况下每个懒加载路由会生成一个单独的 chunk。可以用魔法注释把相关页面打进同一个 chunk：

```javascript
const routes = [
  // 用户模块：打进同一个 chunk
  {
    path: "/user/list",
    component: () =>
      import(/* webpackChunkName: "user" */ "./views/UserList.vue"),
  },
  {
    path: "/user/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "./views/UserDetail.vue"),
  },

  // 订单模块
  {
    path: "/order/list",
    component: () =>
      import(/* webpackChunkName: "order" */ "./views/OrderList.vue"),
  },
];
```

结果：

```
dist/
├── app.js          ← 主 bundle
├── chunk-user.js   ← 用户模块
└── chunk-order.js  ← 订单模块
```

## 效果

我们项目的实际数据：

```
优化前：app.js 1.2MB（gzip 后 380KB）
优化后：
  app.js：340KB（gzip 110KB）
  各功能模块 chunk：50-150KB 不等

首屏加载从 4.2s → 1.8s
```

## 路由级别的 loading 状态

懒加载会有短暂的加载时间，可以用路由的 loading 组件处理：

```javascript
// 创建 Loading 和 Error 组件
const LoadingComponent = {
  template: '<div class="loading">加载中...</div>',
};
const ErrorComponent = {
  template: '<div class="error">加载失败</div>',
};

// 带加载状态的懒加载
function lazyLoad(componentFn) {
  return () => ({
    component: componentFn(),
    loading: LoadingComponent,
    error: ErrorComponent,
    delay: 200, // 200ms 后才显示 loading（避免快速网络下闪烁）
    timeout: 10000, // 10s 超时
  });
}

const routes = [
  {
    path: "/dashboard",
    component: lazyLoad(() => import("./views/Dashboard.vue")),
  },
];
```

## 预加载（Prefetch）

用户还没跳转，但提前下载代码：

```javascript
// webpackPrefetch：浏览器空闲时预下载（推荐）
() => import(/* webpackPrefetch: true */ './views/UserDetail.vue')

// webpackPreload：和当前 chunk 并行下载（适合高概率跳转）
() => import(/* webpackPreload: true */ './views/Dashboard.vue')
```

在后台管理系统里，登录后预加载主要功能模块是个好实践。

## 小结

- 路由懒加载：`component: () => import('./Page.vue')`
- 魔法注释 `webpackChunkName`：把相关页面打进同一个 chunk
- 首屏加载优化：只加载当前需要的 JS，其他按需加载
- `webpackPrefetch`：浏览器空闲时预加载，进一步改善体验