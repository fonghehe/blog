---
title: "Vue 自定义指令实践 - 从 v-focus 到 v-permission"
date: 2019-06-24 16:31:12
tags:
  - Vue
readingTime: 5
description: "Vue 内置指令（v-if、v-for、v-model）大家都很熟悉，但实际项目中我们经常需要直接操作 DOM 的场景——自动聚焦、按钮权限控制、防抖、图片懒加载等。这时候自定义指令就派上用场了。"
---

Vue 内置指令（v-if、v-for、v-model）大家都很熟悉，但实际项目中我们经常需要直接操作 DOM 的场景——自动聚焦、按钮权限控制、防抖、图片懒加载等。这时候自定义指令就派上用场了。

这篇文章记录了我在实际项目中用过的几个自定义指令，从简单到复杂，把踩过的坑也一并分享出来。

## 指令生命周期钩子

先回顾一下 Vue 2.x 自定义指令的五个钩子：

- **bind**：指令第一次绑定到元素时调用（只调用一次）
- **inserted**：被绑定元素插入父节点时调用（父节点存在即可，不一定已被插入文档）
- **update**：所在组件的 VNode 更新时调用（可能发生在子 VNode 更新之前）
- **componentUpdated**：所在组件的 VNode 及其子 VNode 全部更新后调用
- **unbind**：指令与元素解绑时调用（只调用一次）

每个钩子都有 `el`、`binding`、`vnode`、`oldVnode` 等参数。用一张对比图来理解：

```
bind        → 元素刚绑定到指令，还没插入 DOM
inserted    → 元素已经插入 DOM
update      → 组件更新前（可能多次）
componentUpdated → 组件更新后（可能多次）
unbind      → 元素解绑，做清理工作
```

## v-focus：最简单的指令

输入框弹出后自动聚焦，最常见的需求：

```javascript
// 全局注册
Vue.directive('focus', {
  inserted(el) {
    el.focus()
  }
})
```

```html
<template>
  <input v-focus placeholder="请输入搜索内容" />
</template>
```

但实际场景更复杂——比如弹窗里的输入框需要在弹窗打开后才聚焦。`inserted` 只在元素插入 DOM 时触发一次，如果元素一开始是 `v-if="false"`，那切换为 `true` 时确实会触发。但如果用的是 `v-show`，元素一直存在于 DOM 中，`inserted` 不会再次触发。

这种情况需要用 `update` 或 `componentUpdated`：

```javascript
Vue.directive('focus', {
  inserted(el, binding) {
    if (binding.value !== false) {
      el.focus()
    }
  },
  update(el, binding) {
    // 当 value 从 false 变为 true 时聚焦
    if (binding.value && !binding.oldValue) {
      el.focus()
    }
  }
})
```

```html
<template>
  <input v-focus="showInput" v-show="showInput" />
</template>
```

## v-permission：按钮权限控制

后台管理系统中最常见的需求：根据用户权限控制按钮的显示。有人用 `v-if`，但 `v-if` 需要在每个组件里引入权限判断逻辑，而指令可以做到全局统一。

```javascript
// directives/permission.js
import store from '@/store'

Vue.directive('permission', {
  inserted(el, binding) {
    const { value } = binding
    const permissions = store.getters.permissions // 用户权限列表

    if (value && value instanceof Array && value.length > 0) {
      const hasPermission = permissions.some(p => value.includes(p))

      if (!hasPermission) {
        // 方案一：直接移除元素
        el.parentNode && el.parentNode.removeChild(el)

        // 方案二：禁用而不是移除（某些场景更好）
        // el.disabled = true
        // el.classList.add('is-disabled')
        // el.title = '您没有此操作权限'
      }
    } else {
      throw new Error('需要权限数组，如 v-permission="[\'user:add\']"')
    }
  }
})
```

使用方式：

```html
<template>
  <div>
    <button v-permission="['user:add']">新增用户</button>
    <button v-permission="['user:delete']">删除用户</button>
    <button v-permission="['user:edit', 'user:add']">编辑用户</button>
  </div>
</template>
```

**踩过的坑：** 权限数据可能是异步加载的。如果在 `bind` 或 `inserted` 阶段权限数据还没请求回来，指令判断就会出错。解决方案有两个：

方案一：在路由守卫中确保权限数据加载完成后再渲染页面。

方案二：指令中监听权限变化：

```javascript
Vue.directive('permission', {
  inserted(el, binding, vnode) {
    const checkPermission = () => {
      const { value } = binding
      const permissions = store.getters.permissions

      if (value && value.length > 0) {
        const hasPermission = permissions.some(p => value.includes(p))
        if (!hasPermission) {
          el.style.display = 'none'
        } else {
          el.style.display = ''
        }
      }
    }

    // 立即检查一次
    checkPermission()

    // 监听权限变化（需要 Vuex store 支持）
    vnode.context.$watch(
      () => store.getters.permissions,
      () => checkPermission(),
      { deep: true }
    )
  }
})
```

## v-debounce：防抖指令

搜索输入框的防抖控制，避免用户每输入一个字符就发一次请求：

```javascript
Vue.directive('debounce', {
  bind(el, binding) {
    const delay = binding.arg || 300
    let timer = null

    el._debounceHandler = function(e) {
      if (timer) clearTimeout(timer)

      timer = setTimeout(() => {
        // 触发原生 input 事件，让 v-model 更新
        const event = new Event('input', { bubbles: true })
        el.dispatchEvent(event)

        // 如果传了回调函数也执行
        if (typeof binding.value === 'function') {
          binding.value(e)
        }
      }, delay)
    }

    el.addEventListener('input', el._debounceHandler)
  },
  unbind(el) {
    el.removeEventListener('input', el._debounceHandler)
    delete el._debounceHandler
  }
})
```

```html
<template>
  <input v-model="keyword" v-debounce:500="onSearch" />
</template>

<script>
export default {
  data() {
    return { keyword: '' }
  },
  methods: {
    onSearch() {
      this.fetchData(this.keyword)
    }
  }
}
</script>
```

**踩过的坑：** 上面的实现有一个问题——在防抖期间，输入框显示的文字已经更新了（因为 v-model 是同步更新视图的），但实际的 `keyword` 值还没有更新。如果在防抖期间点击提交按钮，拿到的是旧值。

更严谨的做法是不依赖 `dispatchEvent`，而是直接操作 vnode 上的数据：

```javascript
Vue.directive('debounce', {
  bind(el, binding, vnode) {
    const delay = binding.arg || 300
    let timer = null

    el._debounceHandler = function(e) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        // 获取 v-model 对应的表达式
        const modelDirective = vnode.data.directives.find(d => d.name === 'model')
        if (modelDirective) {
          vnode.context[modelDirective.expression] = e.target.value
        }
        if (typeof binding.value === 'function') {
          binding.value(e.target.value)
        }
      }, delay)
    }

    el.addEventListener('input', el._debounceHandler)
  },
  unbind(el) {
    el.removeEventListener('input', el._debounceHandler)
    delete el._debounceHandler
  }
})
```

## v-lazy-load：图片懒加载

在没有 `IntersectionObserver` 的场景下（或者需要兼容老浏览器），可以用指令实现图片懒加载：

```javascript
Vue.directive('lazy-load', {
  bind(el, binding) {
    // 先用占位图替换真实地址
    el._lazySrc = binding.value
    el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

    // 使用 IntersectionObserver（支持的话）
    if ('IntersectionObserver' in window) {
      el._observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target
              img.src = img._lazySrc
              img._observer.unobserve(img)
            }
          })
        },
        { rootMargin: '100px' }
      )
      el._observer.observe(el)
    } else {
      // 降级方案：滚动监听
      const lazyLoad = () => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight + 100) {
          el.src = el._lazySrc
          window.removeEventListener('scroll', el._lazyScrollHandler)
        }
      }
      el._lazyScrollHandler = lazyLoad
      window.addEventListener('scroll', lazyLoad)
      lazyLoad()
    }
  },
  unbind(el) {
    if (el._observer) {
      el._observer.disconnect()
    }
    if (el._lazyScrollHandler) {
      window.removeEventListener('scroll', el._lazyScrollHandler)
    }
  }
})
```

```html
<template>
  <div class="image-list">
    <img v-for="img in images" :key="img.id" v-lazy-load="img.url" />
  </div>
</template>
```

**性能提醒：** 如果列表很长（几百张图），用 `IntersectionObserver` 比滚动监听性能好很多。滚动监听每次都要计算 `getBoundingClientRect`，而 `IntersectionObserver` 是浏览器底层优化过的。

## 全局注册 vs 局部注册

实际项目中建议这样组织：

```javascript
// directives/index.js
import focus from './focus'
import permission from './permission'
import debounce from './debounce'
import lazyLoad from './lazy-load'

const directives = { focus, permission, debounce, lazyLoad }

export default {
  install(Vue) {
    Object.keys(directives).forEach(key => {
      Vue.directive(key, directives[key])
    })
  }
}

// main.js
import directives from './directives'
Vue.use(directives)
```

这样做的好处是所有指令统一管理，新增指令只需要在 `directives` 目录加文件并导出即可。

## 小结

- 自定义指令适合需要**直接操作 DOM** 的场景，不要用来做组件该做的事
- 五个钩子中 `bind` 和 `inserted` 最常用，注意 `v-show` 和 `v-if` 对触发时机的影响
- `unbind` 钩子一定要做清理（移除事件监听、断开 Observer），否则内存泄漏
- 权限指令要处理好异步数据加载的问题，不能假设数据在 `inserted` 时已就绪
- 防抖指令配合 `v-model` 使用时要注意数据同步的时机
- 全局指令建议用 `Vue.use()` 插件方式统一注册，便于管理
