---
title: "Vue 自定义指令开发"
date: 2018-03-22 09:45:46
tags:
  - Vue
---

Vue 自定义指令可以直接操作 DOM，适合封装那些需要直接访问 DOM 元素的逻辑。比如自动聚焦、权限控制、图片懒加载等。

## 指令的生命周期钩子

```javascript
Vue.directive("my-directive", {
  bind(el, binding, vnode) {
    // 指令绑定到元素时调用（只调用一次）
    // 此时元素可能还没插入 DOM
  },
  inserted(el, binding, vnode) {
    // 元素插入父 DOM 后调用
    // 可以操作 DOM，父元素已存在
  },
  update(el, binding, vnode, oldVnode) {
    // 组件 VNode 更新时调用
    // 注意：子组件可能还没更新
  },
  componentUpdated(el, binding, vnode, oldVnode) {
    // 组件和子组件 VNode 都更新后调用
  },
  unbind(el, binding, vnode) {
    // 指令从元素解绑时调用（只调用一次）
    // 清理工作在这里做
  },
});
```

`binding` 对象包含：

- `binding.value`：指令的值（`v-my-dir="value"` 里的 `value`）
- `binding.arg`：指令的参数（`v-my-dir:arg`）
- `binding.modifiers`：修饰符对象（`v-my-dir.modifier`）

## 实战 1：自动聚焦

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

## 实战 2：权限控制

根据用户权限决定是否渲染元素：

```javascript
// src/directives/permission.js
import store from "@/store";

export default {
  inserted(el, binding) {
    const required = binding.value; // 需要的权限，如 'admin' 或 ['admin', 'editor']
    const userPerms = store.getters.permissions;

    const requiredList = Array.isArray(required) ? required : [required];
    const hasPermission = requiredList.some((perm) => userPerms.includes(perm));

    if (!hasPermission) {
      el.parentNode?.removeChild(el); // 直接从 DOM 移除
    }
  },
};
```

```javascript
// 全局注册
import permissionDirective from "./directives/permission";
Vue.directive("permission", permissionDirective);
```

```vue
<template>
  <div>
    <!-- 只有 admin 能看到 -->
    <el-button v-permission="'admin'" type="danger">删除</el-button>

    <!-- admin 或 editor 都能看到 -->
    <el-button v-permission="['admin', 'editor']">编辑</el-button>
  </div>
</template>
```

## 实战 3：图片懒加载

```javascript
Vue.directive("lazyload", {
  inserted(el, binding) {
    const src = binding.value;

    // 用 IntersectionObserver 检测元素是否在视口内
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.src = src;
            observer.unobserve(el); // 加载后取消观察
          }
        });
      },
      {
        threshold: 0.1, // 元素出现 10% 时触发
      },
    );

    observer.observe(el);
    el._observer = observer; // 保存引用，用于 unbind 清理
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

## 实战 4：防重复点击

防止按钮连续点击提交多次请求：

```javascript
Vue.directive("throttle", {
  bind(el, binding) {
    const delay = binding.value || 1000;
    let lastTime = 0;

    el._throttleHandler = function (event) {
      const now = Date.now();
      if (now - lastTime < delay) {
        event.stopImmediatePropagation(); // 阻止后续事件处理
        return;
      }
      lastTime = now;
    };

    el.addEventListener("click", el._throttleHandler, true); // 捕获阶段
  },
  unbind(el) {
    el.removeEventListener("click", el._throttleHandler, true);
  },
});
```

```vue
<el-button v-throttle="2000" @click="handleSubmit">提交</el-button>
```

## 实战 5：点击外部关闭

弹出层、下拉菜单常见需求：

```javascript
Vue.directive("click-outside", {
  bind(el, binding) {
    el._clickOutsideHandler = function (event) {
      if (!el.contains(event.target)) {
        binding.value(event); // 调用传入的函数
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
  <!-- 下拉内容 -->
</div>
```

## 局部注册

不必全局注册，可以在组件内注册：

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

## 小结

自定义指令适合**直接操作 DOM** 的逻辑，不适合业务逻辑。

- 记得在 `unbind` 里清理事件监听器、IntersectionObserver 等资源
- 优先考虑用组件或 mixin 实现功能，指令是补充手段
- 好用的指令：权限控制、懒加载、防重复点击、点击外部关闭
