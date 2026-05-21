---
title: "Vue keep-alive 路由缓存"
date: 2018-02-18 10:12:01
tags:
  - Vue
readingTime: 1
description: "后台管理系统里有一个常见需求：从列表页跳到详情页，再返回时，列表页要保留之前的滚动位置和筛选状态。`keep-alive` 就是解决这个问题的。"
wordCount: 263
---

后台管理系统里有一个常见需求：从列表页跳到详情页，再返回时，列表页要保留之前的滚动位置和筛选状态。`keep-alive` 就是解决这个问题的。

## 基本用法

```html
<!-- App.vue -->
<template>
  <div id="app">
    <keep-alive>
      <router-view />
    </keep-alive>
  </div>
</template>
```

加了 `keep-alive` 之后，路由组件切换时不会被销毁，而是被缓存，再次进入时直接复用。

## 只缓存部分路由

大多数情况下，我们不想缓存所有路由，只缓存特定的几个。

**方案一：include/exclude**

```html
<!-- 只缓存 UserList 和 OrderList -->
<keep-alive :include="['UserList', 'OrderList']">
  <router-view />
</keep-alive>
```

```javascript
// 组件里需要设置 name
export default {
  name: "UserList", // 和 include 里的名字对应
};
```

**方案二：路由 meta 配置（更推荐）**

```javascript
// router.js
const routes = [
  {
    path: "/users",
    component: UserList,
    meta: { keepAlive: true }, // 需要缓存
  },
  {
    path: "/users/:id",
    component: UserDetail,
    meta: { keepAlive: false }, // 不缓存
  },
];
```

```html
<!-- App.vue -->
<keep-alive>
  <router-view v-if="$route.meta.keepAlive" />
</keep-alive>
<router-view v-if="!$route.meta.keepAlive" />
```

## activated 和 deactivated

被 `keep-alive` 缓存的组件，有两个额外的生命周期：

```javascript
export default {
  name: "UserList",
  activated() {
    // 每次组件被"激活"时触发（包括第一次 mounted 之后）
    // 适合：从详情页返回时，刷新数据
    console.log("UserList 被激活");
    this.refreshIfNeeded();
  },
  deactivated() {
    // 组件被"停用"时触发（切走但不销毁）
    console.log("UserList 被停用");
  },
};
```

注意：被缓存的组件，再次进入时**不会触发** `created` 和 `mounted`，只触发 `activated`。

## 实际项目中的滚动恢复

```javascript
export default {
  name: "UserList",
  data() {
    return {
      scrollTop: 0,
    };
  },
  activated() {
    // 恢复滚动位置
    this.$nextTick(() => {
      document.documentElement.scrollTop = this.scrollTop;
    });
  },
  deactivated() {
    // 保存离开时的滚动位置
    this.scrollTop = document.documentElement.scrollTop;
  },
};
```

## 小结

- `keep-alive` 缓存路由组件，避免重复销毁和创建
- 用路由 meta 的 `keepAlive` 字段控制哪些路由需要缓存
- 缓存组件用 `activated`/`deactivated` 代替 `mounted`/`beforeDestroy`
- 适合场景：列表页返回时保持状态、Tab 切换不重置