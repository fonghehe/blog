---
title: "Vue Router 導航守衞全解析：落地路徑與實戰建議"
date: 2018-02-01 16:46:07
tags:
  - Vue
readingTime: 3
description: "Vue Router 的導航守衞是項目裏權限控製的核心，但文檔寫得比較分散，容易搞混。這篇文章把所有守衞梳理一遍，附上實際項目中的用法。"
wordCount: 575
---

Vue Router 的導航守衞是項目裏權限控製的核心，但文檔寫得比較分散，容易搞混。這篇文章把所有守衞梳理一遍，附上實際項目中的用法。

## 守衞的分類

Vue Router 的守衞按作用域分三類：

- **全局守衞**：對所有路由生效
- **路由獨享守衞**：在路由設定裏定義，隻對這條路由生效
- **組件內守衞**：定義在組件裏，感知該組件的進入/離開

## 全局守衞

### beforeEach

最常用的守衞，每次路由跳轉前都會觸發：

```javascript
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");

  // 白名單：不需要登錄的頁面
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

注意：**必須調用 `next()`**，否則路由會卡住不跳轉。這是最容易踩的坑。

### afterEach

路由跳轉完成後觸發，不接受 `next` 參數（已經跳完了）：

```javascript
router.afterEach((to, from) => {
  // 修改頁面標題
  document.title = to.meta.title || "我的應用";

  // 上報 PV
  analytics.trackPageView(to.path);
});
```

### beforeResolve

在導航確認前、所有組件內守衞和異步路由組件解析完成後觸發。用得比較少，但在需要確保組件完全加載後再執行某些操作時有用。

## 路由獨享守衞

直接寫在路由配置裏：

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

這種方式適合某個路由有特殊權限邏輯，不想污染全局守衞。

## 組件內守衞

### beforeRouteEnter

進入組件前觸發，**此時組件實例還沒創建**，所以不能用 `this`：

```javascript
export default {
  beforeRouteEnter(to, from, next) {
    // 這裏不能用 this
    // 通過 next 的回調拿到實例
    next((vm) => {
      vm.fetchData(to.params.id);
    });
  },
};
```

### beforeRouteUpdate

路由變化但組件複用時觸發（比如 `/user/1` → `/user/2`）：

```javascript
export default {
  beforeRouteUpdate(to, from, next) {
    // 這裏可以用 this
    this.userId = to.params.id;
    this.fetchData();
    next();
  },
};
```

這個守衞很多人不知道，導致動態路由參數變化時數據不更新。

### beforeRouteLeave

離開當前路由前觸發，常用於阻止用户意外離開有未保存內容的頁面：

```javascript
export default {
  data() {
    return { isDirty: false };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      const confirm = window.confirm("有未保存的內容，確認離開？");
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

官方文檔有一張順序圖，我簡化一下：

```
1. 導航被觸發
2. 調用離開組件的 beforeRouteLeave
3. 調用全局 beforeEach
4. 調用路由獨享的 beforeEnter（如果有）
5. 解析異步路由組件
6. 調用進入組件的 beforeRouteEnter
7. 調用全局 beforeResolve
8. 導航確認
9. 調用全局 afterEach
10. 觸發 DOM 更新
11. 調用 beforeRouteEnter 的 next 回調
```

理解這個順序，權限邏輯寫在哪裏就很清晰了。

## 項目中的權限控製模式

實際項目裏，我們通常這樣組織權限邏輯：

```javascript
// 路由 meta 字段標註權限
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

// 全局守衞統一處理
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

這種模式把權限聲明放在路由設定，守衞隻負責統一檢查，維護起來比較清晰。

## 小結

- `beforeEach` 是權限攔截的主戰場
- `beforeRouteUpdate` 解決動態路由參數變化時數據不刷新的問題
- `beforeRouteLeave` 防止用户誤操作丟失數據
- 記住 `next()` 必須調用，忘了會卡住整個應用
