---
title: "Vue 3 Custom Directive Development"
date: 2020-01-24 09:35:33
tags:
  - Vue
readingTime: 2
description: "Custom directives were redesigned in Vue 3, with lifecycle hooks aligned to the Composition API naming style. For scenarios requiring direct DOM manipulation—dragging, debounced clicks, permission control—custom directives remain the cleanest abstraction."
wordCount: 209
---

Custom directives were redesigned in Vue 3, with lifecycle hooks following the same naming style as the Composition API. For scenarios that need direct DOM manipulation—dragging, debounced clicks, permission control—custom directives remain the cleanest abstraction.

## Directive Lifecycle Hook Changes

Vue 3 unified Vue 2's `bind`, `inserted`, `update`, etc. into more semantic names:

| Vue 2 | Vue 3 |
|-------|-------|
| bind | beforeMount |
| inserted | mounted |
| update | updated |
| componentUpdated | updated |
| unbind | unmounted |

```javascript
// Vue 3 指令生命周期
const vDirective = {
  beforeMount(el, binding, vnode, prevVnode) {
    // 在元素被插入 DOM 之前
  },
  mounted(el, binding, vnode, prevVnode) {
    // 元素已插入 DOM
  },
  beforeUpdate(el, binding, vnode, prevVnode) {
    // 组件更新前
  },
  updated(el, binding, vnode, prevVnode) {
    // 组件更新后
  },
  beforeUnmount(el, binding, vnode, prevVnode) {
    // 元素即将被移除
  },
  unmounted(el, binding, vnode, prevVnode) {
    // 元素已被移除
  }
}
```

## In Practice: Debounce Directive

One of the most common scenarios: debouncing clicks to prevent duplicate submissions.

```javascript
// directives/v-debounce.js
export default {
  mounted(el, binding) {
    const delay = binding.arg ? parseInt(binding.arg) : 500
    let timer = null

    el.addEventListener('click', (...args) => {
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        binding.value(...args)
        timer = null
      }, delay)
    })
  },

  unmounted(el) {
    // 注意：实际项目中需要在 mounted 时保存 handler 引用
    // 这里简化处理
    el.removeEventListener('click')
  }
}

// 注册
// main.js
import vDebounce from './directives/v-debounce'
app.directive('debounce', vDebounce)

// 使用
// <button v-debounce:1000="handleSubmit">提交</button>
// v-debounce 后面的参数 1000 是延迟毫秒数
```

## In Practice: Permission Control Directive

The backend returns the user's permission list, and the frontend uses the directive to control whether buttons are shown or hidden.

```javascript
// directives/v-permission.js
export default {
  mounted(el, binding) {
    const { value } = binding
    const userPermissions = JSON.parse(
      localStorage.getItem('permissions') || '[]'
    )

    if (Array.isArray(value) && value.length > 0) {
      const hasPermission = value.some(p => userPermissions.includes(p))
      if (!hasPermission) {
        // 方案一：移除元素
        el.parentNode && el.parentNode.removeChild(el)

        // 方案二：禁用而非移除
        // el.disabled = true
        // el.classList.add('is-disabled')
      }
    } else {
      console.warn('v-permission 需要一个权限数组作为值')
    }
  }
}

// main.js
import vPermission from './directives/v-permission'
app.directive('permission', vPermission)

// 使用
// <button v-permission="['order:delete']">删除订单</button>
// <button v-permission="['order:export', 'admin:export']">导出数据</button>
```

## In Practice: Click Outside to Close

Dropdown and Popover components often need this functionality.

```javascript
// directives/v-click-outside.js
export default {
  beforeMount(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    // 使用 capture 阶段确保先于其他事件处理
    document.addEventListener('click', el._clickOutside, true)
  },

  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
    delete el._clickOutside
  }
}

// 使用
// <div v-click-outside="closeDropdown">
//   <button @click="toggle">展开</button>
//   <ul v-show="isOpen">...</ul>
// </div>
```

## Local vs. Global Registration

Besides global registration, directives can also be registered locally within a component.

```vue
<script>
import vDebounce from '../directives/v-debounce'
import vPermission from '../directives/v-permission'

export default {
  directives: {
    debounce: vDebounce,
    permission: vPermission
  },
  template: `
    <button v-debounce:800="save">保存</button>
    <button v-permission="['user:edit']">编辑</button>
  `
}
</script>
```

## Summary

- Vue 3 directive hooks are more semantic and consistent with component lifecycle hooks.
- Directives are suited for pure DOM operations: debouncing, permission control, click-outside, and so on.
- `binding.value` is the directive's bound value, and `binding.arg` is its argument (the `500` in `v-debounce:500`).
- Clean up event listeners in `unmounted` to prevent memory leaks.
- Local directive registration fits scenarios where a directive is only used in a specific component, reducing global pollution.
