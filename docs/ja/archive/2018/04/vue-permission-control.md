---
title: "実践：Vue 2 権限制御の完全ソリューション"
date: 2018-04-14 10:47:04
tags:
  - Vue
readingTime: 3
description: "管理画面システムには権限制御がほぼ必須です。この記事では、Vue 2 + Vue Router + Vuex を使った完全なソリューション（ルート権限 + メニュー権限 + ボタン権限）をまとめます。"
wordCount: 397
---

管理画面システムには権限制御がほぼ必須です。この記事では、Vue 2 + Vue Router + Vuex を使った完全なソリューション（ルート権限 + メニュー権限 + ボタン権限）をまとめます。

## 権限制御の3つのレベル

1. **ルート権限**：特定ページへのアクセスにログインや特定ロールが必要
2. **メニュー権限**：サイドバーにはアクセス可能なメニューのみ表示
3. **操作権限**：ボタンレベル（新規作成・編集・削除を個別に制御）

## データ構造の設計

ログイン後、APIから権限情報を取得します：

```javascript
// APIレスポンス
{
  user: { id: 1, name: 'Alice', role: 'editor' },
  permissions: ['user:list', 'user:edit', 'article:list', 'article:create']
}
```

ルートに必要な権限を宣言します：

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

## Vuexで権限状態を管理

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

## ナビゲーションガード

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

  // ログイン済みだが権限情報がない場合は先に取得
  if (!store.getters.userInfo) {
    try {
      await store.dispatch("permission/initPermissions");
    } catch (e) {
      // トークン有効期限切れ
      localStorage.removeItem("token");
      next(`/login?redirect=${to.fullPath}`);
      return;
    }
  }

  // ルート権限チェック
  const required = to.meta?.permission;
  if (required && !store.getters["permission/hasPermission"](required)) {
    next("/403");
    return;
  }

  next();
});
```

## 動的メニュー

権限に基づいてメニューを動的にレンダリングします：

```javascript
// メニュー設定（権限宣言を含む）
const menuConfig = [
  {
    title: "ユーザー管理",
    icon: "el-icon-user",
    permission: "user:list",
    path: "/users",
  },
  {
    title: "記事管理",
    icon: "el-icon-document",
    children: [
      { title: "記事一覧", path: "/articles", permission: "article:list" },
      {
        title: "新規記事",
        path: "/articles/create",
        permission: "article:create",
      },
    ],
  },
];
```

```vue
{% raw %}
<!-- メニューコンポーネント -->
<template>
  <el-menu>
    <template v-for="item in visibleMenus">
      <!-- サブメニューあり -->
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

      <!-- サブメニューなし -->
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
        // 子メニューがある場合：いずれか1つにアクセス権があれば親を表示
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

## ボタンレベル権限ディレクティブ

```javascript
// カスタムディレクティブ
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
    <el-button v-permission="'user:create'" type="primary"
      >ユーザー追加</el-button
    >
    <el-button v-permission="'user:edit'">編集</el-button>
    <el-button v-permission="'user:delete'" type="danger">削除</el-button>
  </div>
</template>
```

## まとめ

- ルートレベル権限はナビゲーションガード + meta宣言で制御
- メニューレベル権限はcomputedフィルタリングで制御
- ボタンレベル権限はカスタムディレクティブで制御
- 権限データはVuexに保存し、アプリ全体で共有
- 管理者は`isAdmin`ゲッターで権限チェックをスキップ可能
