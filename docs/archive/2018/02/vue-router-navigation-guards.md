---
title: "Vue Router 导航守卫全解析"
date: 2018-02-01 16:46:07
tags:
  - Vue
readingTime: 3
description: "Vue Router 的导航守卫是项目里权限控制的核心，但文档写得比较分散，容易搞混。这篇文章把所有守卫梳理一遍，附上实际项目中的用法。"
---

Vue Router 的导航守卫是项目里权限控制的核心，但文档写得比较分散，容易搞混。这篇文章把所有守卫梳理一遍，附上实际项目中的用法。

## 守卫的分类

Vue Router 的守卫按作用域分三类：

- **全局守卫**：对所有路由生效
- **路由独享守卫**：在路由配置里定义，只对这条路由生效
- **组件内守卫**：定义在组件里，感知该组件的进入/离开

## 全局守卫

### beforeEach

最常用的守卫，每次路由跳转前都会触发：

```javascript
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");

  // 白名单：不需要登录的页面
  const whiteList = ["/login", "/register", "/about"];

  if (whiteList.includes(to.path)) {
    next();
    return;
  }

  if (!token) {
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  next();
});
```

注意：**必须调用 `next()`**，否则路由会卡住不跳转。这是最容易踩的坑。

### afterEach

路由跳转完成后触发，不接受 `next` 参数（已经跳完了）：

```javascript
router.afterEach((to, from) => {
  // 修改页面标题
  document.title = to.meta.title || "我的应用";

  // 上报 PV
  analytics.trackPageView(to.path);
});
```

### beforeResolve

在导航确认前、所有组件内守卫和异步路由组件解析完成后触发。用得比较少，但在需要确保组件完全加载后再执行某些操作时有用。

## 路由独享守卫

直接写在路由配置里：

```javascript
const routes = [
  {
    path: "/admin",
    component: AdminPanel,
    beforeEnter: (to, from, next) => {
      const user = store.getters.currentUser;
      if (!user || user.role !== "admin") {
        next("/403");
        return;
      }
      next();
    },
  },
];
```

这种方式适合某个路由有特殊权限逻辑，不想污染全局守卫。

## 组件内守卫

### beforeRouteEnter

进入组件前触发，**此时组件实例还没创建**，所以不能用 `this`：

```javascript
export default {
  beforeRouteEnter(to, from, next) {
    // 这里不能用 this
    // 通过 next 的回调拿到实例
    next((vm) => {
      vm.fetchData(to.params.id);
    });
  },
};
```

### beforeRouteUpdate

路由变化但组件复用时触发（比如 `/user/1` → `/user/2`）：

```javascript
export default {
  beforeRouteUpdate(to, from, next) {
    // 这里可以用 this
    this.userId = to.params.id;
    this.fetchData();
    next();
  },
};
```

这个守卫很多人不知道，导致动态路由参数变化时数据不更新。

### beforeRouteLeave

离开当前路由前触发，常用于阻止用户意外离开有未保存内容的页面：

```javascript
export default {
  data() {
    return { isDirty: false };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      const confirm = window.confirm("有未保存的内容，确认离开？");
      if (!confirm) {
        next(false); // 阻止导航
        return;
      }
    }
    next();
  },
};
```

## 完整的导航解析流程

官方文档有一张顺序图，我简化一下：

```
1. 导航被触发
2. 调用离开组件的 beforeRouteLeave
3. 调用全局 beforeEach
4. 调用路由独享的 beforeEnter（如果有）
5. 解析异步路由组件
6. 调用进入组件的 beforeRouteEnter
7. 调用全局 beforeResolve
8. 导航确认
9. 调用全局 afterEach
10. 触发 DOM 更新
11. 调用 beforeRouteEnter 的 next 回调
```

理解这个顺序，权限逻辑写在哪里就很清晰了。

## 项目中的权限控制模式

实际项目里，我们通常这样组织权限逻辑：

```javascript
// 路由 meta 字段标注权限
const routes = [
  {
    path: "/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true, roles: ["admin", "editor"] },
  },
  {
    path: "/settings",
    component: Settings,
    meta: { requiresAuth: true, roles: ["admin"] },
  },
];

// 全局守卫统一处理
router.beforeEach((to, from, next) => {
  if (!to.meta.requiresAuth) {
    next();
    return;
  }

  const user = store.getters.user;
  if (!user) {
    next("/login");
    return;
  }

  const requiredRoles = to.meta.roles;
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    next("/403");
    return;
  }

  next();
});
```

这种模式把权限声明放在路由配置，守卫只负责统一检查，维护起来比较清晰。

## 小结

- `beforeEach` 是权限拦截的主战场
- `beforeRouteUpdate` 解决动态路由参数变化时数据不刷新的问题
- `beforeRouteLeave` 防止用户误操作丢失数据
- 记住 `next()` 必须调用，忘了会卡住整个应用
