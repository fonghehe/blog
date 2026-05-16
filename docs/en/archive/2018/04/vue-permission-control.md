---
title: "Practical Guide: Complete Vue 2 Permission Control"
date: 2018-04-14 10:47:04
tags:
  - Vue
readingTime: 2
description: "Permission control is almost a necessity in admin systems. This article outlines a complete solution: route permissions + menu permissions + button permissions,"
---

Permission control is almost a necessity in admin systems. This article outlines a complete solution: route permissions + menu permissions + button permissions, built on Vue 2 + Vue Router + Vuex.

## Three Levels of Permission Control

1. **Route permissions**: certain pages require login / specific roles
2. **Menu permissions**: the sidebar only shows items the user has access to
3. **Operation permissions**: button-level control (create, edit, delete managed separately)

## Data Structure Design

After login, fetch permission info from the API:

```javascript
// API response
{
  user: { id: 1, name: 'Alice', role: 'editor' },
  permissions: ['user:list', 'user:edit', 'article:list', 'article:create']
}
```

Declare required permissions on routes:

```javascript
const routes = [
  {
    path: "/users",
    component: UserListPage,
    meta: {
      requiresAuth: true,
      permission: "user:list",
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

## Storing Permissions in Vuex

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

## Navigation Guard

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

  // Logged in but no permission info yet — fetch it first
  if (!store.getters.userInfo) {
    try {
      await store.dispatch("permission/initPermissions");
    } catch (e) {
      // Token expired
      localStorage.removeItem("token");
      next(`/login?redirect=${to.fullPath}`);
      return;
    }
  }

  // Check route permission
  const required = to.meta?.permission;
  if (required && !store.getters["permission/hasPermission"](required)) {
    next("/403");
    return;
  }

  next();
});
```

## Dynamic Menu

Render the menu dynamically based on permissions:

```javascript
// Menu config (with permission declarations)
const menuConfig = [
  {
    title: "User Management",
    icon: "el-icon-user",
    permission: "user:list",
    path: "/users",
  },
  {
    title: "Article Management",
    icon: "el-icon-document",
    children: [
      { title: "Article List", path: "/articles", permission: "article:list" },
      {
        title: "New Article",
        path: "/articles/create",
        permission: "article:create",
      },
    ],
  },
];
```

```vue
{% raw %}
<!-- Menu component -->
<template>
  <el-menu>
    <template v-for="item in visibleMenus">
      <!-- Has sub-menu -->
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

      <!-- No sub-menu -->
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
        // Has children: show parent if at least one child is accessible
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

## Button-Level Permission Directive

```javascript
// Custom directive
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
    <el-button v-permission="'user:create'" type="primary">New User</el-button>
    <el-button v-permission="'user:edit'">Edit</el-button>
    <el-button v-permission="'user:delete'" type="danger">Delete</el-button>
  </div>
</template>
```

## Summary

- Route-level permissions rely on navigation guards + meta declarations
- Menu-level permissions rely on computed filtering
- Button-level permissions rely on custom directives
- Permission data lives in Vuex, shared across the app
- Admin bypasses all permission checks via the `isAdmin` getter
