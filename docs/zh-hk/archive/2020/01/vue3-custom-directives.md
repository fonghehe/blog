---
title: "Vue 3 自定義指令開發"
date: 2020-01-24 09:35:33
tags:
  - Vue
readingTime: 2
description: "自定義指令在 Vue 3 中經過了重設計，生命週期鈎子和 Composition API 保持了一致的命名風格。對於需要直接操作 DOM 的場景——拖拽、防抖點擊、權限控制——自定義指令仍然是最乾淨的抽象方式。"
---

自定義指令在 Vue 3 中經過了重設計，生命週期鈎子和 Composition API 保持了一致的命名風格。對於需要直接操作 DOM 的場景——拖拽、防抖點擊、權限控制——自定義指令仍然是最乾淨的抽象方式。

## 指令生命週期鈎子變化

Vue 3 將 Vue 2 的 `bind`、`inserted`、`update` 等統一為更語義化的命名：

| Vue 2 | Vue 3 |
|
-------|-------|
| bind | beforeMount |
| inserted | mounted |
| update | updated |
| componentUpdated | updated |
| unbind | unmounted |

```javascript
// Vue 3 指令生命週期
const vDirective = {
  beforeMount(el, binding, vnode, prevVnode) {
    // 在元素被插入 DOM 之前
  },
  mounted(el, binding, vnode, prevVnode) {
    // 元素已插入 DOM
  },
  beforeUpdate(el, binding, vnode, prevVnode) {
    // 組件更新前
  },
  updated(el, binding, vnode, prevVnode) {
    // 組件更新後
  },
  beforeUnmount(el, binding, vnode, prevVnode) {
    // 元素即將被移除
  },
  unmounted(el, binding, vnode, prevVnode) {
    // 元素已被移除
  }
}
```

## 實戰：防抖指令

最常用的場景之一，點擊防抖避免重複提交。

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
    // 注意：實際項目中需要在 mounted 時保存 handler 引用
    // 這裏簡化處理
    el.removeEventListener('click')
  }
}

// 註冊
// main.js
import vDebounce from './directives/v-debounce'
app.directive('debounce', vDebounce)

// 使用
// <button v-debounce:1000="handleSubmit">提交</button>
// v-debounce 後面的參數 1000 是延遲毫秒數
```

## 實戰：權限控制指令

後端返回用户權限列表，前端通過指令控制按鈕顯隱。

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
      console.warn('v-permission 需要一個權限數組作為值')
    }
  }
}

// main.js
import vPermission from './directives/v-permission'
app.directive('permission', vPermission)

// 使用
// <button v-permission="['order:delete']">刪除訂單</button>
// <button v-permission="['order:export', 'admin:export']">導出數據</button>
```

## 實戰：點擊外部關閉

Dropdown 和 Popover 組件經常需要這個功能。

```javascript
// directives/v-click-outside.js
export default {
  beforeMount(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    // 使用 capture 階段確保先於其他事件處理
    document.addEventListener('click', el._clickOutside, true)
  },

  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
    delete el._clickOutside
  }
}

// 使用
// <div v-click-outside="closeDropdown">
//   <button @click="toggle">展開</button>
//   <ul v-show="isOpen">...</ul>
// </div>
```

## 局部註冊與全局註冊

除了全局註冊，指令也可以在組件內局部註冊。

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
    <button v-permission="['user:edit']">編輯</button>
  `
}
</script>
```

## 小結

- Vue 3 指令鈎子命名更語義化，與組件生命週期一致
- 指令適合處理純 DOM 操作：防抖、權限控制、點擊外部等
- `binding.value` 是指令綁定值，`binding.arg` 是參數（`v-debounce:500` 中的 500）
- 在 `unmounted` 中清理事件監聽，防止內存泄漏
- 局部註冊指令適合只在特定組件使用的場景，減少全局污染
