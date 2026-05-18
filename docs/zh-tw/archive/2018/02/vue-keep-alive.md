---
title: "Vue keep-alive 路由快取"
date: 2018-02-18 10:12:01
tags:
  - Vue
readingTime: 1
description: "後臺管理系統裡有一個常見需求：從列表頁跳到詳情頁，再返回時，列表頁要保留之前的滾動位置和篩選狀態。`keep-alive` 就是解決這個問題的。"
---

後臺管理系統裡有一個常見需求：從列表頁跳到詳情頁，再返回時，列表頁要保留之前的滾動位置和篩選狀態。`keep-alive` 就是解決這個問題的。

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

加了 `keep-alive` 之後，路由元件切換時不會被銷燬，而是被快取，再次進入時直接複用。

## 只快取部分路由

大多數情況下，我們不想快取所有路由，只快取特定的幾個。

**方案一：include/exclude**

```html
<!-- 只快取 UserList 和 OrderList -->
<keep-alive :include="['UserList', 'OrderList']">
  <router-view />
</keep-alive>
```

```javascript
// 元件裡需要設定 name
export default {
  name: "UserList", // 和 include 裡的名字對應
};
```

**方案二：路由 meta 配置（更推薦）**

```javascript
// router.js
const routes = [
  {
    path: "/users",
    component: UserList,
    meta: { keepAlive: true }, // 需要快取
  },
  {
    path: "/users/:id",
    component: UserDetail,
    meta: { keepAlive: false }, // 不快取
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

被 `keep-alive` 快取的元件，有兩個額外的生命週期：

```javascript
export default {
  name: "UserList",
  activated() {
    // 每次元件被"啟用"時觸發（包括第一次 mounted 之後）
    // 適合：從詳情頁返回時，重新整理資料
    console.log("UserList 被啟用");
    this.refreshIfNeeded();
  },
  deactivated() {
    // 元件被"停用"時觸發（切走但不銷燬）
    console.log("UserList 被停用");
  },
};
```

注意：被快取的元件，再次進入時**不會觸發** `created` 和 `mounted`，只觸發 `activated`。

## 實際專案中的滾動恢復

```javascript
export default {
  name: "UserList",
  data() {
    return {
      scrollTop: 0,
    };
  },
  activated() {
    // 恢復滾動位置
    this.$nextTick(() => {
      document.documentElement.scrollTop = this.scrollTop;
    });
  },
  deactivated() {
    // 儲存離開時的滾動位置
    this.scrollTop = document.documentElement.scrollTop;
  },
};
```

## 小結

- `keep-alive` 快取路由元件，避免重複銷燬和建立
- 用路由 meta 的 `keepAlive` 欄位控制哪些路由需要快取
- 快取元件用 `activated`/`deactivated` 代替 `mounted`/`beforeDestroy`
- 適合場景：列表頁返回時保持狀態、Tab 切換不重置