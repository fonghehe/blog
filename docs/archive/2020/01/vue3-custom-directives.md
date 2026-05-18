---
title: "Vue 3 自定义指令开发"
date: 2020-01-24 09:35:33
tags:
  - Vue
readingTime: 2
description: "自定义指令在 Vue 3 中经过了重设计，生命周期钩子和 Composition API 保持了一致的命名风格。对于需要直接操作 DOM 的场景——拖拽、防抖点击、权限控制——自定义指令仍然是最干净的抽象方式。"
---

自定义指令在 Vue 3 中经过了重设计，生命周期钩子和 Composition API 保持了一致的命名风格。对于需要直接操作 DOM 的场景——拖拽、防抖点击、权限控制——自定义指令仍然是最干净的抽象方式。

## 指令生命周期钩子变化

Vue 3 将 Vue 2 的 `bind`、`inserted`、`update` 等统一为更语义化的命名：

| Vue 2 | Vue 3 |
|
-------|-------|
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

## 实战：防抖指令

最常用的场景之一，点击防抖避免重复提交。

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

## 实战：权限控制指令

后端返回用户权限列表，前端通过指令控制按钮显隐。

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

## 实战：点击外部关闭

Dropdown 和 Popover 组件经常需要这个功能。

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

## 局部注册与全局注册

除了全局注册，指令也可以在组件内局部注册。

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

## 小结

- Vue 3 指令钩子命名更语义化，与组件生命周期一致
- 指令适合处理纯 DOM 操作：防抖、权限控制、点击外部等
- `binding.value` 是指令绑定值，`binding.arg` 是参数（`v-debounce:500` 中的 500）
- 在 `unmounted` 中清理事件监听，防止内存泄漏
- 局部注册指令适合只在特定组件使用的场景，减少全局污染
