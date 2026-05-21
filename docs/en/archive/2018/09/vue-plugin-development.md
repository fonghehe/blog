---
title: "Vue Plugin Development in Practice"
date: 2018-09-21 10:12:44
tags:
  - Vue
readingTime: 1
description: "Vue's plugin mechanism allows features to be registered globally with a single `Vue.use()` call. I built an internal toast notification plugin — here's how I di"
wordCount: 93
---

Vue's plugin mechanism allows features to be registered globally with a single `Vue.use()` call. I built an internal toast notification plugin — here's how I did it.

## Vue Plugin Structure

A plugin must have an `install` method (or be a function itself):

```javascript
// Basic plugin structure
const MyPlugin = {
  install(Vue, options) {
    // options come from Vue.use(MyPlugin, options)

    // 1. Add global methods or properties
    Vue.myGlobalMethod = function () {};

    // 2. Add global assets: directives, filters, transitions, etc.
    Vue.directive("my-directive", {
      /* ... */
    });
    Vue.filter("my-filter", function () {
      /* ... */
    });

    // 3. Inject component options
    Vue.mixin({
      created() {
        /* ... */
      },
    });

    // 4. Add instance methods (via prototype)
    Vue.prototype.$myMethod = function () {
      /* ... */
    };
  },
};
```

## In Practice: A $toast Notification Plugin

```javascript
// plugins/toast/index.js
import ToastComponent from "./Toast.vue";

let instance = null;

const Toast = {
  install(Vue) {
    // Create a Vue subclass and mount the Toast component
    const ToastConstructor = Vue.extend(ToastComponent);

    function showToast(message, type = "info", duration = 3000) {
      if (!instance) {
        instance = new ToastConstructor();
        instance.$mount();
        document.body.appendChild(instance.$el);
      }
      instance.show(message, type, duration);
    }

    // Attach to Vue prototype
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

## Registering and Using

```javascript
// main.js
import Toast from "./plugins/toast";
Vue.use(Toast);

// In any component
this.$toast.success("Saved successfully!");
this.$toast.error("Network error, please retry");
```

## Plugin with Global Config

```javascript
const Loading = {
  install(Vue, options = {}) {
    const defaultOptions = {
      color: "#409EFF",
      text: "Loading...",
    };
    const config = { ...defaultOptions, ...options };

    Vue.prototype.$loading = {
      show(text = config.text) {
        // Show loading
      },
      hide() {
        // Hide loading
      },
    };
  },
};

// Pass config when using
Vue.use(Loading, { color: "#f90", text: "Please wait..." });
```

## Summary

- Plugin = `install(Vue, options)` function
- `Vue.prototype.$xxx`: add instance methods accessible via `this.$xxx` in all components
- `Vue.extend` + manual `$mount`: dynamically create and append components to the body
- Plugins are ideal for: global toast/loading/dialog, global filters/directives, global mixins
