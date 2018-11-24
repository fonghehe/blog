---
title: "Vue Router 导航守卫实战"
date: 2018-11-24 11:06:12
tags:
  - Vue
---

项目越做越大，路由权限控制变得复杂：有的页面要登录才能访问，有的页面只有管理员能进，有的页面在离开前要确认是否保存……导航守卫能统一处理这些。

## 全局前置守卫

```javascript
// router/index.js
import router from "./config";
import store from "@/store";

const WHITE_LIST = ["/login", "/register", "/forgot-password"];

router.beforeEach(async (to, from, next) => {
  const token = store.getters.token;

  if (WHITE_LIST.includes(to.path)) {
    // 白名单页面，直接放行
    next();
    return;
  }

  if (!token) {
    // 没有登录，跳转到登录页，并记录来源路径（登录后可以跳回来）
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  // 已登录但没有用户信息（首次进入或刷新页面）
  if (!store.getters.userInfo) {
    try {
      await store.dispatch("user/getUserInfo");
      // 重新导航（因为权限信息刚加载）
      next({ ...to, replace: true });
    } catch (e) {
      // 获取用户信息失败（token 可能已失效）
      await store.dispatch("user/logout");
      next("/login");
    }
    return;
  }

  next();
});
```

## 基于 meta 的权限控制

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
// 在 beforeEach 里检查权限
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !store.getters.isLoggedIn) {
    next("/login");
    return;
  }

  if (to.meta.roles) {
    const userRole = store.getters.userRole;
    if (!to.meta.roles.includes(userRole)) {
      next("/403"); // 无权限页面
      return;
    }
  }

  next();
});
```

## 组件内守卫：表单离开确认

```javascript
export default {
  data() {
    return {
      isDirty: false, // 表单是否有未保存的修改
    };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      this.$confirm("有未保存的修改，确定要离开吗？", "提示", {
        confirmButtonText: "离开",
        cancelButtonText: "留下",
        type: "warning",
      })
        .then(() => {
          next(); // 确认离开
        })
        .catch(() => {
          next(false); // 取消，留在当前页
        });
    } else {
      next();
    }
  },
};
```

## 路由独享守卫

```javascript
const routes = [
  {
    path: "/pay/:orderId",
    component: PayPage,
    // 只在这个路由上的守卫
    beforeEnter(to, from, next) {
      // 检查订单是否可以支付
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

## 全局后置钩子

```javascript
// 路由切换完成后执行（不能调用 next）
router.afterEach((to, from) => {
  // 修改页面标题
  document.title = to.meta.title || "管理系统";

  // 上报 PV
  analytics.track("pageview", { path: to.path });

  // 关闭全局 loading
  NProgress.done();
});
```

## 登录后跳回来源页

```javascript
// 登录成功后
const redirect = this.$route.query.redirect || "/dashboard";
this.$router.push(redirect);
```

## 小结

- `beforeEach`：全局前置，处理登录检查、权限控制
- `afterEach`：全局后置，修改标题、上报 PV
- `beforeRouteLeave`：组件内，处理表单离开确认
- `beforeEnter`：路由独享，处理特定路由的进入逻辑
- 用 `meta` 字段声明路由的权限要求，守卫里统一处理
