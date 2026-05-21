---
title: "Vue Router 導航守衛全解析"
date: 2018-02-01 16:46:07
tags:
  - Vue
readingTime: 3
description: "Vue Router 的導航守衛是專案裡許可權控制的核心，但文件寫得比較分散，容易搞混。這篇文章把所有守衛梳理一遍，附上實際專案中的用法。"
wordCount: 590
---

Vue Router 的導航守衛是專案裡許可權控制的核心，但文件寫得比較分散，容易搞混。這篇文章把所有守衛梳理一遍，附上實際專案中的用法。

## 守衛的分類

Vue Router 的守衛按作用域分三類：

- **全域性守衛**：對所有路由生效
- **路由獨享守衛**：在路由配置裡定義，只對這條路由生效
- **元件內守衛**：定義在元件裡，感知該元件的進入/離開

## 全域性守衛

### beforeEach

最常用的守衛，每次路由跳轉前都會觸發：

```javascript
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");

  // 白名單：不需要登入的頁面
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

注意：**必須呼叫 `next()`**，否則路由會卡住不跳轉。這是最容易踩的坑。

### afterEach

路由跳轉完成後觸發，不接受 `next` 引數（已經跳完了）：

```javascript
router.afterEach((to, from) => {
  // 修改頁面標題
  document.title = to.meta.title || "我的應用";

  // 上報 PV
  analytics.trackPageView(to.path);
});
```

### beforeResolve

在導航確認前、所有元件內守衛和非同步路由元件解析完成後觸發。用得比較少，但在需要確保元件完全載入後再執行某些操作時有用。

## 路由獨享守衛

直接寫在路由配置裡：

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

這種方式適合某個路由有特殊許可權邏輯，不想汙染全域性守衛。

## 元件內守衛

### beforeRouteEnter

進入元件前觸發，**此時元件例項還沒建立**，所以不能用 `this`：

```javascript
export default {
  beforeRouteEnter(to, from, next) {
    // 這裡不能用 this
    // 通過 next 的回撥拿到例項
    next((vm) => {
      vm.fetchData(to.params.id);
    });
  },
};
```

### beforeRouteUpdate

路由變化但元件複用時觸發（比如 `/user/1` → `/user/2`）：

```javascript
export default {
  beforeRouteUpdate(to, from, next) {
    // 這裡可以用 this
    this.userId = to.params.id;
    this.fetchData();
    next();
  },
};
```

這個守衛很多人不知道，導致動態路由引數變化時資料不更新。

### beforeRouteLeave

離開當前路由前觸發，常用於阻止使用者意外離開有未儲存內容的頁面：

```javascript
export default {
  data() {
    return { isDirty: false };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      const confirm = window.confirm("有未儲存的內容，確認離開？");
      if (!confirm) {
        next(false); // 阻止導航
        return;
      }
    }
    next();
  },
};
```

## 完整的導航解析流程

官方文件有一張順序圖，我簡化一下：

```
1. 導航被觸發
2. 呼叫離開元件的 beforeRouteLeave
3. 呼叫全域性 beforeEach
4. 呼叫路由獨享的 beforeEnter（如果有）
5. 解析非同步路由元件
6. 呼叫進入元件的 beforeRouteEnter
7. 呼叫全域性 beforeResolve
8. 導航確認
9. 呼叫全域性 afterEach
10. 觸發 DOM 更新
11. 呼叫 beforeRouteEnter 的 next 回撥
```

理解這個順序，許可權邏輯寫在哪裡就很清晰了。

## 專案中的許可權控制模式

實際專案裡，我們通常這樣組織許可權邏輯：

```javascript
// 路由 meta 欄位標註許可權
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

// 全域性守衛統一處理
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

這種模式把許可權宣告放在路由配置，守衛只負責統一檢查，維護起來比較清晰。

## 小結

- `beforeEach` 是許可權攔截的主戰場
- `beforeRouteUpdate` 解決動態路由引數變化時資料不重新整理的問題
- `beforeRouteLeave` 防止使用者誤操作丟失資料
- 記住 `next()` 必須呼叫，忘了會卡住整個應用
