---
title: "实战：Vue 2 权限控制完整方案"
date: 2018-04-14 10:47:04
tags:
  - Vue
readingTime: 2
description: "中后台系统几乎必然要做权限控制。这篇文章整理一套完整方案：路由权限 + 菜单权限 + 按钮权限，基于 Vue 2 + Vue Router + Vuex。"
wordCount: 247
---

中后台系统几乎必然要做权限控制。这篇文章整理一套完整方案：路由权限 + 菜单权限 + 按钮权限，基于 Vue 2 + Vue Router + Vuex。

## 权限控制的三个层次

1. **路由权限**：某些页面需要登录/特定角色才能访问
2. **菜单权限**：侧边栏只显示有权限的菜单项
3. **操作权限**：按钮级别（新增、编辑、删除分开控制）

## 数据结构设计

用户登录后，从接口获取权限信息：

```javascript
// 接口返回
{
  user: { id: 1, name: 'Alice', role: 'editor' },
  permissions: ['user:list', 'user:edit', 'article:list', 'article:create']
}
```

路由表上声明所需权限：

```javascript
const routes = [
  {
    path: "/users",
    component: UserListPage,
    meta: {
      requiresAuth: true,
      permission: "user:list", // 访问此路由需要的权限
    },
  },
  {
    path: "/users/create",
    component: UserCreatePage,
    meta: {
      requiresAuth: true,
      permission: "user:create",
    },
  },
];
```

## Vuex 存储权限状态

```javascript
// store/modules/permission.js
const state = {
  permissions: [],
  userInfo: null,
};

const getters = {
  hasPermission: (state) => (perm) => {
    return state.permissions.includes(perm);
  },
  isAdmin: (state) => {
    return state.userInfo?.role === "admin";
  },
};

const mutations = {
  SET_PERMISSIONS(state, permissions) {
    state.permissions = permissions;
  },
  SET_USER_INFO(state, userInfo) {
    state.userInfo = userInfo;
  },
};

const actions = {
  async initPermissions({ commit }) {
    const { user, permissions } = await fetchCurrentUser();
    commit("SET_USER_INFO", user);
    commit("SET_PERMISSIONS", permissions);
    return permissions;
  },
};
```

## 路由守卫

```javascript
// router/permission.js
import store from "@/store";
import router from "@/router";

const whiteList = ["/login", "/403", "/404"];

router.beforeEach(async (to, from, next) => {
  const token = localStorage.getItem("token");

  if (!token) {
    if (whiteList.includes(to.path)) {
      next();
    } else {
      next(`/login?redirect=${to.fullPath}`);
    }
    return;
  }

  // 已登录但没有权限信息，先获取
  if (!store.getters.userInfo) {
    try {
      await store.dispatch("permission/initPermissions");
    } catch (e) {
      // token 失效
      localStorage.removeItem("token");
      next(`/login?redirect=${to.fullPath}`);
      return;
    }
  }

  // 检查路由权限
  const required = to.meta?.permission;
  if (required && !store.getters["permission/hasPermission"](required)) {
    next("/403");
    return;
  }

  next();
});
```

## 动态菜单

菜单根据权限动态渲染：

```javascript
// 菜单配置（包含权限声明）
const menuConfig = [
  {
    title: "用户管理",
    icon: "el-icon-user",
    permission: "user:list",
    path: "/users",
  },
  {
    title: "文章管理",
    icon: "el-icon-document",
    children: [
      { title: "文章列表", path: "/articles", permission: "article:list" },
      {
        title: "新增文章",
        path: "/articles/create",
        permission: "article:create",
      },
    ],
  },
];
```

```vue
{% raw %}
<!-- 菜单组件 -->
<template>
  <el-menu>
    <template v-for="item in visibleMenus">
      <!-- 有子菜单 -->
      <el-submenu v-if="item.children" :key="item.title">
        <template slot="title">{{ item.title }}</template>
        <el-menu-item
          v-for="child in item.children"
          v-if="hasPermission(child.permission)"
          :key="child.path"
          :index="child.path"
        >
          {{ child.title }}
        </el-menu-item>
      </el-submenu>

      <!-- 无子菜单 -->
      <el-menu-item v-else :key="item.path" :index="item.path">
        {{ item.title }}
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script>
export default {
  computed: {
    visibleMenus() {
      return menuConfig.filter((item) => {
        if (item.permission) {
          return this.$store.getters["permission/hasPermission"](
            item.permission,
          );
        }
        // 有子菜单：只要有任意一个子菜单权限就显示父菜单
        if (item.children) {
          return item.children.some((child) =>
            this.$store.getters["permission/hasPermission"](child.permission),
          );
        }
        return true;
      });
    },
  },
  methods: {
    hasPermission(perm) {
      return this.$store.getters["permission/hasPermission"](perm);
    },
  },
};
</script>
{% endraw %}
```

## 按钮级权限指令

```javascript
// 自定义指令
Vue.directive("permission", {
  inserted(el, binding) {
    const perm = binding.value;
    const hasPermission = store.getters["permission/hasPermission"](perm);
    if (!hasPermission) {
      el.parentNode?.removeChild(el);
    }
  },
});
```

```vue
<template>
  <div>
    <el-button v-permission="'user:create'" type="primary">新增用户</el-button>
    <el-button v-permission="'user:edit'">编辑</el-button>
    <el-button v-permission="'user:delete'" type="danger">删除</el-button>
  </div>
</template>
```

## 小结

- 路由级权限靠路由守卫 + meta 声明
- 菜单级权限靠 computed 过滤
- 按钮级权限靠自定义指令
- 权限数据存在 Vuex，整个应用共享
- admin 可以跳过权限检查（`isAdmin` getter）
