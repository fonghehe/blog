---
title: "Vue 3 カスタムディレクティブ開発"
date: 2020-01-24 09:35:33
tags:
  - Vue
readingTime: 3
description: "自定义指令在 Vue 3 中经过了重设计，生命周期钩子和 Composition API 保持了一致的命名风格。对于需要直接操作 DOM 的场景——拖拽、防抖点击、权限控制——自定义指令仍然是最干净的抽象方式。"
wordCount: 549
---

カスタムディレクティブは Vue 3 で再設計され、ライフサイクルフックと Composition API は一貫した命名スタイルを保っている。DOM を直接操作する必要がある場面——ドラッグ、クリックのデバウンス、権限制御——では、カスタムディレクティブがいまだに最もすっきりした抽象だ。

## ディレクティブライフサイクルフックの変更

Vue 3 は Vue 2 の `bind`、`inserted`、`update` などをより意味的な命名に統一した：

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

## 実践：デバウンスディレクティブ

最もよく使う場面の一つが、クリックのデバウンスで重複送信を防ぐことだ。

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

## 実践：権限制御ディレクティブ

バックエンドがユーザーの権限リストを返し、フロントエンドはディレクティブでボタンの表示／非表示を制御する。

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

## 実践：外側クリックで閉じる

Dropdown や Popover コンポーネントはこの機能をよく必要とする。

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

## ローカル登録とグローバル登録

グローバル登録以外に、ディレクティブはコンポーネント内でローカルにも登録できる。

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

## まとめ

- Vue 3 のディレクティブフックの命名はより意味的で、コンポーネントのライフサイクルと一致する
- ディレクティブは純粋な DOM 操作に向く：デバウンス、権限制御、外側クリックなど
- `binding.value` はディレクティブのバインド値、`binding.arg` は引数（`v-debounce:500` の 500）
- `unmounted` でイベントリスナーを片付け、メモリリークを防ぐ
- ローカル登録は特定のコンポーネントだけで使うディレクティブに向き、グローバルな汚染を減らす
