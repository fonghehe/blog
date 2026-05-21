---
title: "Vue 自定義指令開發"
date: 2018-03-22 09:45:46
tags:
  - Vue
readingTime: 2
description: "Vue 自定義指令可以直接操作 DOM，適合封裝那些需要直接訪問 DOM 元素的邏輯。比如自動聚焦、權限控制、圖片懶加載等。"
wordCount: 269
---

Vue 自定義指令可以直接操作 DOM，適合封裝那些需要直接訪問 DOM 元素的邏輯。比如自動聚焦、權限控制、圖片懶加載等。

## 指令的生命週期鈎子

```javascript
Vue.directive("my-directive", {
  bind(el, binding, vnode) {
    // 指令綁定到元素時調用（只調用一次）
    // 此時元素可能還沒插入 DOM
  },
  inserted(el, binding, vnode) {
    // 元素插入父 DOM 後調用
    // 可以操作 DOM，父元素已存在
  },
  update(el, binding, vnode, oldVnode) {
    // 組件 VNode 更新時調用
    // 注意：子組件可能還沒更新
  },
  componentUpdated(el, binding, vnode, oldVnode) {
    // 組件和子組件 VNode 都更新後調用
  },
  unbind(el, binding, vnode) {
    // 指令從元素解綁時調用（只調用一次）
    // 清理工作在這裏做
  },
});
```

`binding` 對象包含：

- `binding.value`：指令的值（`v-my-dir="value"` 裏的 `value`）
- `binding.arg`：指令的參數（`v-my-dir:arg`）
- `binding.modifiers`：修飾符對象（`v-my-dir.modifier`）

## 實戰 1：自動聚焦

```javascript
Vue.directive("focus", {
  inserted(el) {
    el.focus();
  },
});
```

```vue
<el-input v-focus placeholder="搜索" />
```

## 實戰 2：權限控制

根據用户權限決定是否渲染元素：

```javascript
// src/directives/permission.js
import store from "@/store";

export default {
  inserted(el, binding) {
    const required = binding.value; // 需要的權限，如 'admin' 或 ['admin', 'editor']
    const userPerms = store.getters.permissions;

    const requiredList = Array.isArray(required) ? required : [required];
    const hasPermission = requiredList.some((perm) => userPerms.includes(perm));

    if (!hasPermission) {
      el.parentNode?.removeChild(el); // 直接從 DOM 移除
    }
  },
};
```

```javascript
// 全局註冊
import permissionDirective from "./directives/permission";
Vue.directive("permission", permissionDirective);
```

```vue
<template>
  <div>
    <!-- 只有 admin 能看到 -->
    <el-button v-permission="'admin'" type="danger">刪除</el-button>

    <!-- admin 或 editor 都能看到 -->
    <el-button v-permission="['admin', 'editor']">編輯</el-button>
  </div>
</template>
```

## 實戰 3：圖片懶加載

```javascript
Vue.directive("lazyload", {
  inserted(el, binding) {
    const src = binding.value;

    // 用 IntersectionObserver 檢測元素是否在視口內
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.src = src;
            observer.unobserve(el); // 加載後取消觀察
          }
        });
      },
      {
        threshold: 0.1, // 元素出現 10% 時觸發
      },
    );

    observer.observe(el);
    el._observer = observer; // 保存引用，用於 unbind 清理
  },
  unbind(el) {
    el._observer?.disconnect();
  },
});
```

```vue
<img
  v-lazyload="'https://example.com/large-image.jpg'"
  src="/placeholder.png"
/>
```

## 實戰 4：防重複點擊

防止按鈕連續點擊提交多次請求：

```javascript
Vue.directive("throttle", {
  bind(el, binding) {
    const delay = binding.value || 1000;
    let lastTime = 0;

    el._throttleHandler = function (event) {
      const now = Date.now();
      if (now - lastTime < delay) {
        event.stopImmediatePropagation(); // 阻止後續事件處理
        return;
      }
      lastTime = now;
    };

    el.addEventListener("click", el._throttleHandler, true); // 捕獲階段
  },
  unbind(el) {
    el.removeEventListener("click", el._throttleHandler, true);
  },
});
```

```vue
<el-button v-throttle="2000" @click="handleSubmit">提交</el-button>
```

## 實戰 5：點擊外部關閉

彈出層、下拉菜單常見需求：

```javascript
Vue.directive("click-outside", {
  bind(el, binding) {
    el._clickOutsideHandler = function (event) {
      if (!el.contains(event.target)) {
        binding.value(event); // 調用傳入的函數
      }
    };
    document.addEventListener("click", el._clickOutsideHandler);
  },
  unbind(el) {
    document.removeEventListener("click", el._clickOutsideHandler);
  },
});
```

```vue
<div v-click-outside="closeDropdown" class="dropdown">
  <!-- 下拉內容 -->
</div>
```

## 局部註冊

不必全局註冊，可以在組件內註冊：

```javascript
export default {
  directives: {
    focus: {
      inserted(el) {
        el.focus();
      },
    },
  },
};
```

## 小結

自定義指令適合**直接操作 DOM** 的邏輯，不適合業務邏輯。

- 記得在 `unbind` 裏清理事件監聽器、IntersectionObserver 等資源
- 優先考慮用組件或 mixin 實現功能，指令是補充手段
- 好用的指令：權限控制、懶加載、防重複點擊、點擊外部關閉
