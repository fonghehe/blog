---
title: "Vue Router 導航守衛實戰"
date: 2018-11-24 11:06:12
tags:
  - Vue
readingTime: 2
description: "專案越做越大，路由許可權控制變得複雜：有的頁面要登入才能訪問，有的頁面只有管理員能進，有的頁面在離開前要確認是否儲存……導航守衛能統一處理這些。"
wordCount: 197
---

專案越做越大，路由許可權控制變得複雜：有的頁面要登入才能訪問，有的頁面只有管理員能進，有的頁面在離開前要確認是否儲存……導航守衛能統一處理這些。

## 全域性前置守衛

```javascript
// router/index.js
import router from "./config";
import store from "@/store";

const WHITE_LIST = ["/login", "/register", "/forgot-password"];

router.beforeEach(async (to, from, next) => {
  const token = store.getters.token;

  if (WHITE_LIST.includes(to.path)) {
    // 白名單頁面，直接放行
    next();
    return;
  }

  if (!token) {
    // 沒有登入，跳轉到登入頁，並記錄來源路徑（登入後可以跳回來）
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  // 已登入但沒有使用者資訊（首次進入或重新整理頁面）
  if (!store.getters.userInfo) {
    try {
      await store.dispatch("user/getUserInfo");
      // 重新導航（因為許可權資訊剛載入）
      next({ ...to, replace: true });
    } catch (e) {
      // 獲取使用者資訊失敗（token 可能已失效）
      await store.dispatch("user/logout");
      next("/login");
    }
    return;
  }

  next();
});
```

## 基於 meta 的許可權控制

```javascript
// router/routes.js
const routes = [
  {
    path: "/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/admin",
    component: AdminPanel,
    meta: { requiresAuth: true, roles: ["admin"] },
  },
  {
    path: "/settings",
    component: Settings,
    meta: { requiresAuth: true, roles: ["admin", "editor"] },
  },
];
```

```javascript
// 在 beforeEach 裡檢查許可權
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !store.getters.isLoggedIn) {
    next("/login");
    return;
  }

  if (to.meta.roles) {
    const userRole = store.getters.userRole;
    if (!to.meta.roles.includes(userRole)) {
      next("/403"); // 無許可權頁面
      return;
    }
  }

  next();
});
```

## 元件內守衛：表單離開確認

```javascript
export default {
  data() {
    return {
      isDirty: false, // 表單是否有未儲存的修改
    };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      this.$confirm("有未儲存的修改，確定要離開嗎？", "提示", {
        confirmButtonText: "離開",
        cancelButtonText: "留下",
        type: "warning",
      })
        .then(() => {
          next(); // 確認離開
        })
        .catch(() => {
          next(false); // 取消，留在當前頁
        });
    } else {
      next();
    }
  },
};
```

## 路由獨享守衛

```javascript
const routes = [
  {
    path: "/pay/:orderId",
    component: PayPage,
    // 只在這個路由上的守衛
    beforeEnter(to, from, next) {
      // 檢查訂單是否可以支付
      const orderId = to.params.orderId;
      if (!orderId || !isValidOrderId(orderId)) {
        next("/404");
        return;
      }
      next();
    },
  },
];
```

## 全域性後置鉤子

```javascript
// 路由切換完成後執行（不能呼叫 next）
router.afterEach((to, from) => {
  // 修改頁面標題
  document.title = to.meta.title || "管理系統";

  // 上報 PV
  analytics.track("pageview", { path: to.path });

  // 關閉全域性 loading
  NProgress.done();
});
```

## 登入後跳回來源頁

```javascript
// 登入成功後
const redirect = this.$route.query.redirect || "/dashboard";
this.$router.push(redirect);
```

## 小結

- `beforeEach`：全域性前置，處理登入檢查、許可權控制
- `afterEach`：全域性後置，修改標題、上報 PV
- `beforeRouteLeave`：元件內，處理表單離開確認
- `beforeEnter`：路由獨享，處理特定路由的進入邏輯
- 用 `meta` 欄位宣告路由的許可權要求，守衛裡統一處理
