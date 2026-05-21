---
title: "Vue 外掛開發實戰"
date: 2018-09-21 10:12:44
tags:
  - Vue
readingTime: 1
description: "Vue 的外掛機制讓功能可以全域性註冊，用 `Vue.use()` 一鍵引入。做了一個公司內部用的訊息提示外掛，記錄一下開發過程。"
wordCount: 158
---

Vue 的外掛機制讓功能可以全域性註冊，用 `Vue.use()` 一鍵引入。做了一個公司內部用的訊息提示外掛，記錄一下開發過程。

## Vue 外掛結構

外掛必須有一個 `install` 方法（或者外掛本身就是函式）：

```javascript
// 外掛基本結構
const MyPlugin = {
  install(Vue, options) {
    // options 是 Vue.use(MyPlugin, options) 傳進來的配置

    // 1. 新增全域性方法或屬性
    Vue.myGlobalMethod = function () {};

    // 2. 新增全域性資源：指令、過濾器、過渡等
    Vue.directive("my-directive", {
      /* ... */
    });
    Vue.filter("my-filter", function () {
      /* ... */
    });

    // 3. 注入元件選項
    Vue.mixin({
      created() {
        /* ... */
      },
    });

    // 4. 新增例項方法（通過原型）
    Vue.prototype.$myMethod = function () {
      /* ... */
    };
  },
};
```

## 實戰：$toast 訊息提示外掛

```javascript
// plugins/toast/index.js
import ToastComponent from "./Toast.vue";

let instance = null;

const Toast = {
  install(Vue) {
    // 建立一個 Vue 子類，掛載 Toast 元件
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

// 任意元件裡
this.$toast.success("儲存成功！");
this.$toast.error("網路錯誤，請重試");
```

## 帶全域性配置的外掛

```javascript
const Loading = {
  install(Vue, options = {}) {
    const defaultOptions = {
      color: "#409EFF",
      text: "載入中...",
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

- 外掛 = `install(Vue, options)` 函式
- `Vue.prototype.$xxx`：新增例項方法，所有元件可以用 `this.$xxx`
- `Vue.extend` + 手動 `$mount`：動態建立元件並掛到 body
- 外掛適合：全域性 toast/loading/dialog、全域性過濾器/指令、全域性混入