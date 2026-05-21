---
title: "Vue Custom Directives"
date: 2018-03-22 09:45:46
tags:
  - Vue
readingTime: 2
description: "Vue custom directives let you directly manipulate the DOM, making them ideal for encapsulating logic that needs direct DOM element access — such as auto-focus, "
wordCount: 171
---

Vue custom directives let you directly manipulate the DOM, making them ideal for encapsulating logic that needs direct DOM element access — such as auto-focus, permission control, and image lazy loading.

## Directive Lifecycle Hooks

```javascript
Vue.directive("my-directive", {
  bind(el, binding, vnode) {
    // Called once when the directive is bound to the element
    // The element may not be in the DOM yet
  },
  inserted(el, binding, vnode) {
    // Called after the element is inserted into the parent DOM
    // Safe to access the DOM; the parent element exists
  },
  update(el, binding, vnode, oldVnode) {
    // Called when the component's VNode updates
    // Note: child components may not have updated yet
  },
  componentUpdated(el, binding, vnode, oldVnode) {
    // Called after the component and its children's VNodes have all updated
  },
  unbind(el, binding, vnode) {
    // Called once when the directive is unbound from the element
    // Do cleanup here
  },
});
```

The `binding` object contains:

- `binding.value`: the directive's value (`value` in `v-my-dir="value"`)
- `binding.arg`: the directive's argument (`v-my-dir:arg`)
- `binding.modifiers`: an object of modifiers (`v-my-dir.modifier`)

## Example 1: Auto Focus

```javascript
Vue.directive("focus", {
  inserted(el) {
    el.focus();
  },
});
```

```vue
<el-input v-focus placeholder="Search" />
```

## Example 2: Permission Control

Show or hide elements based on user permissions:

```javascript
// src/directives/permission.js
import store from "@/store";

export default {
  inserted(el, binding) {
    const required = binding.value; // required permission, e.g. 'admin' or ['admin', 'editor']
    const userPerms = store.getters.permissions;

    const requiredList = Array.isArray(required) ? required : [required];
    const hasPermission = requiredList.some((perm) => userPerms.includes(perm));

    if (!hasPermission) {
      el.parentNode?.removeChild(el); // remove directly from DOM
    }
  },
};
```

```javascript
// Global registration
import permissionDirective from "./directives/permission";
Vue.directive("permission", permissionDirective);
```

```vue
<template>
  <div>
    <!-- Only visible to admin -->
    <el-button v-permission="'admin'" type="danger">Delete</el-button>

    <!-- Visible to admin or editor -->
    <el-button v-permission="['admin', 'editor']">Edit</el-button>
  </div>
</template>
```

## Example 3: Image Lazy Loading

```javascript
Vue.directive("lazyload", {
  inserted(el, binding) {
    const src = binding.value;

    // Use IntersectionObserver to detect when the element is in the viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.src = src;
            observer.unobserve(el); // stop observing after loading
          }
        });
      },
      {
        threshold: 0.1, // trigger when 10% of the element is visible
      },
    );

    observer.observe(el);
    el._observer = observer; // save reference for cleanup in unbind
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

## Example 4: Prevent Duplicate Clicks

Prevent a button from being clicked multiple times in quick succession:

```javascript
Vue.directive("throttle", {
  bind(el, binding) {
    const delay = binding.value || 1000;
    let lastTime = 0;

    el._throttleHandler = function (event) {
      const now = Date.now();
      if (now - lastTime < delay) {
        event.stopImmediatePropagation(); // block subsequent event handlers
        return;
      }
      lastTime = now;
    };

    el.addEventListener("click", el._throttleHandler, true); // capture phase
  },
  unbind(el) {
    el.removeEventListener("click", el._throttleHandler, true);
  },
});
```

```vue
<el-button v-throttle="2000" @click="handleSubmit">Submit</el-button>
```

## Example 5: Click Outside to Close

A common requirement for popovers and dropdown menus:

```javascript
Vue.directive("click-outside", {
  bind(el, binding) {
    el._clickOutsideHandler = function (event) {
      if (!el.contains(event.target)) {
        binding.value(event); // call the passed-in function
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
  <!-- dropdown content -->
</div>
```

## Local Registration

You don't have to register globally — you can register directives locally within a component:

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

## Summary

Custom directives are suited for logic that **directly manipulates the DOM**, not for business logic.

- Always clean up event listeners, IntersectionObservers, and other resources in `unbind`
- Prefer components or mixins first; directives are a supplemental tool
- Practical directives: permission control, lazy loading, click throttle, click outside
