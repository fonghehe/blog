---
title: "實戰：Vue 2 許可權控製完整方案"
date: 2018-04-14 10:47:04
tags:
  - Vue
readingTime: 2
description: "中後臺系統幾乎必然要做許可權控製。這篇文章整理一套完整方案：路由許可權 + 選單許可權 + 按鈕許可權，基於 Vue 2 + Vue Router + Vuex。"
wordCount: 267
---

中後臺系統幾乎必然要做許可權控製。這篇文章整理一套完整方案：路由許可權 + 選單許可權 + 按鈕許可權，基於 Vue 2 + Vue Router + Vuex。

## 許可權控製的三個層次

1. **路由許可權**：某些頁面需要登入/特定角色才能訪問
2. **選單許可權**：側邊欄隻顯示有許可權的選單項
3. **操作許可權**：按鈕級別（新增、編輯、刪除分開控製）

## 資料結構設計

使用者登入後，從介面獲取許可權資訊：

```javascript
// 介面返回
{
  user: { id: 1, name: 'Alice', role: 'editor' },
  permissions: ['user:list', 'user:edit', 'article:list', 'article:create']
}
```

路由表上宣告所需許可權：

```javascript
const routes = [
  {
    path: "/users",
    component: UserListPage,
    meta: {
      requiresAuth: true,
      permission: "user:list", // 訪問此路由需要的許可權
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

## Vuex 儲存許可權狀態

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

## 路由守衛

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

  // 已登入但沒有許可權資訊，先獲取
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

  // 檢查路由許可權
  const required = to.meta?.permission;
  if (required && !store.getters["permission/hasPermission"](required)) {
    next("/403");
    return;
  }

  next();
});
```

## 動態選單

選單根據許可權動態渲染：

```javascript
// 選單配置（包含許可權宣告）
const menuConfig = [
  {
    title: "使用者管理",
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
<!-- 選單元件 -->
<template>
  <el-menu>
    <template v-for="item in visibleMenus">
      <!-- 有子選單 -->
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

      <!-- 無子選單 -->
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
        // 有子選單：隻要有任意一個子選單許可權就顯示父選單
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

## 按鈕級許可權指令

```javascript
// 自定義指令
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
    <el-button v-permission="'user:create'" type="primary">新增使用者</el-button>
    <el-button v-permission="'user:edit'">編輯</el-button>
    <el-button v-permission="'user:delete'" type="danger">刪除</el-button>
  </div>
</template>
```

## 小結

- 路由級許可權靠路由守衛 + meta 宣告
- 選單級許可權靠 computed 過濾
- 按鈕級許可權靠自定義指令
- 許可權資料存在 Vuex，整個應用共享
- admin 可以跳過許可權檢查（`isAdmin` getter）
