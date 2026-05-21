---
title: "Vue Custom Directives in Practice: From v-focus to v-permission"
date: 2019-06-24 16:31:12
tags:
  - Vue
readingTime: 1
description: "Vue's built-in directives (`v-model`, `v-if`, `v-for`) cover most use cases, but there are scenarios where you need to directly manipulate DOM behavior — that's"
wordCount: 134
---

Vue's built-in directives (`v-model`, `v-if`, `v-for`) cover most use cases, but there are scenarios where you need to directly manipulate DOM behavior — that's when custom directives shine. This article covers directive lifecycle hooks and two real-world examples.

## Directive Lifecycle Hooks

```javascript
Vue.directive("my-directive", {
  // Called once, before the element is bound to the parent
  bind(el, binding, vnode) {
    // el: the element
    // binding: { value, oldValue, arg, modifiers, name }
    // vnode: Vue's virtual node
  },

  // Called once after the element is inserted into the parent
  inserted(el, binding, vnode) {},

  // Called when the component's VNode is updated
  update(el, binding, vnode, oldVnode) {},

  // Called after the component's children VNodes are updated
  componentUpdated(el, binding, vnode, oldVnode) {},

  // Called once when the directive is unbound from the element
  unbind(el, binding, vnode) {},
});
```

In practice, `bind` and `inserted` are used most often. `bind` runs before the element is in the DOM (can't measure dimensions); `inserted` runs after the element is inserted (can access computed styles and dimensions).

## Example 1: v-focus with v-show Support

```javascript
// Simple v-focus: focus on mount
Vue.directive("focus", {
  inserted(el) {
    el.focus();
  },
});
// Usage: <input v-focus />
```

But this breaks when used with `v-show` — the element may be hidden on mount. Add a mutation observer to handle that:

```javascript
Vue.directive("focus", {
  inserted(el, binding) {
    if (el.style.display !== "none") {
      el.focus();
      return;
    }
    // Watch for visibility changes via MutationObserver
    const observer = new MutationObserver(() => {
      if (el.style.display !== "none") {
        el.focus();
        observer.disconnect();
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    // Clean up observer on unmount
    el._focusObserver = observer;
  },
  unbind(el) {
    el._focusObserver?.disconnect();
  },
});
```

## Example 2: v-permission for Admin Systems

```javascript
// Register globally
Vue.directive("permission", {
  inserted(el, binding) {
    const { value: requiredPermissions } = binding;
    const userPermissions = store.getters["auth/permissions"];

    const hasPermission = Array.isArray(requiredPermissions)
      ? requiredPermissions.some((p) => userPermissions.includes(p))
      : userPermissions.includes(requiredPermissions);

    if (!hasPermission) {
      // Remove element from DOM rather than just hiding it
      el.parentNode?.removeChild(el);
    }
  },
});
```

```html
<!-- Usage -->
<!-- Single permission -->
<button v-permission="'user:delete'">Delete User</button>

<!-- Any of multiple permissions -->
<button v-permission="['user:edit', 'user:delete']">Edit</button>
```

Custom directives are best for logic that needs direct DOM access. For component-level behavior that involves state, use composables (or mixins in Vue 2) instead.
