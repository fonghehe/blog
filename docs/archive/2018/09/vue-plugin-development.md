---
title: "Vue 插件开发实战"
date: 2018-09-21 10:12:44
tags:
  - Vue
readingTime: 1
description: "Vue 的插件机制让功能可以全局注册，用 `Vue.use()` 一键引入。做了一个公司内部用的消息提示插件，记录一下开发过程。"
wordCount: 153
---

Vue 的插件机制让功能可以全局注册，用 `Vue.use()` 一键引入。做了一个公司内部用的消息提示插件，记录一下开发过程。

## Vue 插件结构

插件必须有一个 `install` 方法（或者插件本身就是函数）：

```javascript
// 插件基本结构
const MyPlugin = {
  install(Vue, options) {
    // options 是 Vue.use(MyPlugin, options) 传进来的配置

    // 1. 添加全局方法或属性
    Vue.myGlobalMethod = function () {};

    // 2. 添加全局资源：指令、过滤器、过渡等
    Vue.directive("my-directive", {
      /* ... */
    });
    Vue.filter("my-filter", function () {
      /* ... */
    });

    // 3. 注入组件选项
    Vue.mixin({
      created() {
        /* ... */
      },
    });

    // 4. 添加实例方法（通过原型）
    Vue.prototype.$myMethod = function () {
      /* ... */
    };
  },
};
```

## 实战：$toast 消息提示插件

```javascript
// plugins/toast/index.js
import ToastComponent from "./Toast.vue";

let instance = null;

const Toast = {
  install(Vue) {
    // 创建一个 Vue 子类，挂载 Toast 组件
    const ToastConstructor = Vue.extend(ToastComponent);

    function showToast(message, type = "info", duration = 3000) {
      if (!instance) {
        instance = new ToastConstructor();
        instance.$mount();
        document.body.appendChild(instance.$el);
      }
      instance.show(message, type, duration);
    }

    // 挂到 Vue 原型上
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

## 注册和使用

```javascript
// main.js
import Toast from "./plugins/toast";
Vue.use(Toast);

// 任意组件里
this.$toast.success("保存成功！");
this.$toast.error("网络错误，请重试");
```

## 带全局配置的插件

```javascript
const Loading = {
  install(Vue, options = {}) {
    const defaultOptions = {
      color: "#409EFF",
      text: "加载中...",
    };
    const config = { ...defaultOptions, ...options };

    Vue.prototype.$loading = {
      show(text = config.text) {
        // 显示 loading
      },
      hide() {
        // 隐藏 loading
      },
    };
  },
};

// 使用时传入配置
Vue.use(Loading, { color: "#f90", text: "请稍候..." });
```

## 小结

- 插件 = `install(Vue, options)` 函数
- `Vue.prototype.$xxx`：添加实例方法，所有组件可以用 `this.$xxx`
- `Vue.extend` + 手动 `$mount`：动态创建组件并挂到 body
- 插件适合：全局 toast/loading/dialog、全局过滤器/指令、全局混入