---
title: "Vue Router 的懶載入和效能最佳化"
date: 2018-06-30 09:32:13
tags:
  - Vue
readingTime: 2
description: "後臺管理系統越來越大，首頁載入時間越來越長。用 Vue Router 的懶載入把初始 bundle 拆開，明顯感受到了加速。"
wordCount: 259
---

後臺管理系統越來越大，首頁載入時間越來越長。用 Vue Router 的懶載入把初始 bundle 拆開，明顯感受到了加速。

## 什麼是路由懶載入

```javascript
// 不用懶載入：所有頁面打進一個 bundle
import Home from "./views/Home.vue";
import User from "./views/User.vue";
import Order from "./views/Order.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/user", component: User },
  { path: "/order", component: Order },
];

// 問題：使用者進首頁，也要下載 User 和 Order 的程式碼
```

```javascript
// 懶載入：只有訪問對應路由時才下載該頁面的程式碼
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

## 分組打包（魔法註釋）

預設情況下每個懶載入路由會生成一個單獨的 chunk。可以用魔法註釋把相關頁面打進同一個 chunk：

```javascript
const routes = [
  // 使用者模組：打進同一個 chunk
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

  // 訂單模組
  {
    path: "/order/list",
    component: () =>
      import(/* webpackChunkName: "order" */ "./views/OrderList.vue"),
  },
];
```

結果：

```
dist/
├── app.js          ← 主 bundle
├── chunk-user.js   ← 使用者模組
└── chunk-order.js  ← 訂單模組
```

## 效果

我們專案的實際資料：

```
最佳化前：app.js 1.2MB（gzip 後 380KB）
最佳化後：
  app.js：340KB（gzip 110KB）
  各功能模組 chunk：50-150KB 不等

首屏載入從 4.2s → 1.8s
```

## 路由級別的 loading 狀態

懶載入會有短暫的載入時間，可以用路由的 loading 元件處理：

```javascript
// 建立 Loading 和 Error 元件
const LoadingComponent = {
  template: '<div class="loading">載入中...</div>',
};
const ErrorComponent = {
  template: '<div class="error">載入失敗</div>',
};

// 帶載入狀態的懶載入
function lazyLoad(componentFn) {
  return () => ({
    component: componentFn(),
    loading: LoadingComponent,
    error: ErrorComponent,
    delay: 200, // 200ms 後才顯示 loading（避免快速網路下閃爍）
    timeout: 10000, // 10s 超時
  });
}

const routes = [
  {
    path: "/dashboard",
    component: lazyLoad(() => import("./views/Dashboard.vue")),
  },
];
```

## 預載入（Prefetch）

使用者還沒跳轉，但提前下載程式碼：

```javascript
// webpackPrefetch：瀏覽器空閒時預下載（推薦）
() => import(/* webpackPrefetch: true */ './views/UserDetail.vue')

// webpackPreload：和當前 chunk 並行下載（適合高機率跳轉）
() => import(/* webpackPreload: true */ './views/Dashboard.vue')
```

在後臺管理系統裡，登入後預載入主要功能模組是個好實踐。

## 小結

- 路由懶載入：`component: () => import('./Page.vue')`
- 魔法註釋 `webpackChunkName`：把相關頁面打進同一個 chunk
- 首屏載入最佳化：只加載當前需要的 JS，其他按需載入
- `webpackPrefetch`：瀏覽器空閒時預載入，進一步改善體驗