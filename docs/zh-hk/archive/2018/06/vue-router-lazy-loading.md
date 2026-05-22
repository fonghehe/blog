---
title: "Vue Router 的懶加載和效能優化：實踐方法與治理思路"
date: 2018-06-30 09:32:13
tags:
  - Vue
readingTime: 2
description: "後臺管理系統越來越大，首頁加載時間越來越長。用 Vue Router 的懶加載把初始 bundle 拆開，明顯感受到了加速。"
wordCount: 256
---

後臺管理系統越來越大，首頁加載時間越來越長。用 Vue Router 的懶加載把初始 bundle 拆開，明顯感受到了加速。

## 什麼是路由懶加載

```javascript
// 不用懶加載：所有頁面打進一個 bundle
import Home from "./views/Home.vue";
import User from "./views/User.vue";
import Order from "./views/Order.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/user", component: User },
  { path: "/order", component: Order },
];

// 問題：用户進首頁，也要下載 User 和 Order 的代碼
```

```javascript
// 懶加載：隻有訪問對應路由時才下載該頁面的代碼
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

默認情況下每個懶加載路由會生成一個單獨的 chunk。可以用魔法註釋把相關頁面打進同一個 chunk：

```javascript
const routes = [
  // 用户模塊：打進同一個 chunk
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

  // 訂單模塊
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
├── chunk-user.js   ← 用户模塊
└── chunk-order.js  ← 訂單模塊
```

## 效果

我們項目的實際數據：

```
優化前：app.js 1.2MB（gzip 後 380KB）
優化後：
  app.js：340KB（gzip 110KB）
  各功能模塊 chunk：50-150KB 不等

首屏加載從 4.2s → 1.8s
```

## 路由級別的 loading 狀態

懶加載會有短暫的加載時間，可以用路由的 loading 組件處理：

```javascript
// 創建 Loading 和 Error 組件
const LoadingComponent = {
  template: '<div class="loading">加載中...</div>',
};
const ErrorComponent = {
  template: '<div class="error">加載失敗</div>',
};

// 帶加載狀態的懶加載
function lazyLoad(componentFn) {
  return () => ({
    component: componentFn(),
    loading: LoadingComponent,
    error: ErrorComponent,
    delay: 200, // 200ms 後才顯示 loading（避免快速網絡下閃爍）
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

## 預加載（Prefetch）

用户還沒跳轉，但提前下載代碼：

```javascript
// webpackPrefetch：瀏覽器空閒時預下載（推薦）
() => import(/* webpackPrefetch: true */ './views/UserDetail.vue')

// webpackPreload：和當前 chunk 並行下載（適合高概率跳轉）
() => import(/* webpackPreload: true */ './views/Dashboard.vue')
```

在後臺管理系統裏，登錄後預加載主要功能模塊是個好實踐。

## 小結

- 路由懶加載：`component: () => import('./Page.vue')`
- 魔法註釋 `webpackChunkName`：把相關頁面打進同一個 chunk
- 首屏加載優化：隻加載當前需要的 JS，其他按需加載
- `webpackPrefetch`：瀏覽器空閒時預加載，進一步改善體驗