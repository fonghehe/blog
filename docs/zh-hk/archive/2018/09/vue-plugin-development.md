---
title: "Vue 外掛開發實戰：落地路徑與實戰建議"
date: 2018-09-21 10:12:44
tags:
  - Vue
readingTime: 1
description: "Vue 的外掛機製讓功能可以全局註冊，用 `Vue.use()` 一鍵引入。做了一個公司內部用的消息提示外掛，記錄一下開發過程。"
wordCount: 153
---

Vue 的外掛機製讓功能可以全局註冊，用 `Vue.use()` 一鍵引入。做了一個公司內部用的消息提示外掛，記錄一下開發過程。

## Vue 外掛結構

插件必須有一個 `install` 方法（或者插件本身就是函數）：

```javascript
// 插件基本結構
const MyPlugin = {
  install(Vue, options) {
    // options 是 Vue.use(MyPlugin, options) 傳進來的配置

    // 1. 添加全局方法或屬性
    Vue.myGlobalMethod = function () {};

    // 2. 添加全局資源：指令、過濾器、過渡等
    Vue.directive("my-directive", {
      /* ... */
    });
    Vue.filter("my-filter", function () {
      /* ... */
    });

    // 3. 注入組件選項
    Vue.mixin({
      created() {
        /* ... */
      },
    });

    // 4. 添加實例方法（通過原型）
    Vue.prototype.$myMethod = function () {
      /* ... */
    };
  },
};
```

## 實戰：$toast 消息提示外掛

```javascript
// plugins/toast/index.js
import ToastComponent from "./Toast.vue";

let instance = null;

const Toast = {
  install(Vue) {
    // 創建一個 Vue 子類，掛載 Toast 組件
    const ToastConstructor = Vue.extend(ToastComponent);

    function showToast(message, type = "info", duration = 3000) {
      if (!instance) {
        instance = new ToastConstructor();
        instance.$mount();
        document.body.appendChild(instance.$el);
      }
      instance.show(message, type, duration);
    }

    // 掛到 Vue 原型上
    Vue.prototype.$toast = {
      info: (msg, duration) => showToast(msg, "info", duration),
      success: (msg, duration) => showToast(msg, "success", duration),
      warning: (msg, duration) => showToast(msg, "warning", duration),
      error: (msg, duration) => showToast(msg, "error", duration),
    };
  },
};

export default Toast;
```

```vue
<!-- plugins/toast/Toast.vue -->
<template>
  <transition name="toast-fade">
    <div v-if="visible" :class="['toast', `toast--${type}`]">
      {{ message }}
    </div>
  </transition>
</template>

<script>
export default {
  data() {
    return {
      visible: false,
      message: "",
      type: "info",
    };
  },
  methods: {
    show(message, type, duration) {
      this.message = message;
      this.type = type;
      this.visible = true;
      setTimeout(() => {
        this.visible = false;
      }, duration);
    },
  },
};
</script>
```

## 註冊和使用

```javascript
// main.js
import Toast from "./plugins/toast";
Vue.use(Toast);

// 任意組件裏
this.$toast.success("保存成功！");
this.$toast.error("網絡錯誤，請重試");
```

## 帶全局設定的外掛

```javascript
const Loading = {
  install(Vue, options = {}) {
    const defaultOptions = {
      color: "#409EFF",
      text: "加載中...",
    };
    const config = { ...defaultOptions, ...options };

    Vue.prototype.$loading = {
      show(text = config.text) {
        // 顯示 loading
      },
      hide() {
        // 隱藏 loading
      },
    };
  },
};

// 使用時傳入配置
Vue.use(Loading, { color: "#f90", text: "請稍候..." });
```

## 小結

- 插件 = `install(Vue, options)` 函數
- `Vue.prototype.$xxx`：添加實例方法，所有組件可以用 `this.$xxx`
- `Vue.extend` + 手動 `$mount`：動態創建組件並掛到 body
- 插件適合：全局 toast/loading/dialog、全局過濾器/指令、全局混入