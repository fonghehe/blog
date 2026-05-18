---
title: "Vue 自定義指令實踐 - 從 v-focus 到 v-permission"
date: 2019-06-24 16:31:12
tags:
  - Vue
readingTime: 5
description: "Vue 內置指令（v-if、v-for、v-model）大家都很熟悉，但實際項目中我們經常需要直接操作 DOM 的場景——自動聚焦、按鈕權限控制、防抖、圖片懶加載等。這時候自定義指令就派上用場了。"
---

Vue 內置指令（v-if、v-for、v-model）大家都很熟悉，但實際項目中我們經常需要直接操作 DOM 的場景——自動聚焦、按鈕權限控制、防抖、圖片懶加載等。這時候自定義指令就派上用場了。

這篇文章記錄了我在實際項目中用過的幾個自定義指令，從簡單到複雜，把踩過的坑也一併分享出來。

## 指令生命週期鈎子

先回顧一下 Vue 2.x 自定義指令的五個鈎子：

- **bind**：指令第一次綁定到元素時調用（只調用一次）
- **inserted**：被綁定元素插入父節點時調用（父節點存在即可，不一定已被插入文檔）
- **update**：所在組件的 VNode 更新時調用（可能發生在子 VNode 更新之前）
- **componentUpdated**：所在組件的 VNode 及其子 VNode 全部更新後調用
- **unbind**：指令與元素解綁時調用（只調用一次）

每個鈎子都有 `el`、`binding`、`vnode`、`oldVnode` 等參數。用一張對比圖來理解：

```
bind        → 元素剛綁定到指令，還沒插入 DOM
inserted    → 元素已經插入 DOM
update      → 組件更新前（可能多次）
componentUpdated → 組件更新後（可能多次）
unbind      → 元素解綁，做清理工作
```

## v-focus：最簡單的指令

輸入框彈出後自動聚焦，最常見的需求：

```javascript
// 全局註冊
Vue.directive('focus', {
  inserted(el) {
    el.focus()
  }
})
```

```html
<template>
  <input v-focus placeholder="請輸入搜索內容" />
</template>
```

但實際場景更復雜——比如彈窗裏的輸入框需要在彈窗打開後才聚焦。`inserted` 只在元素插入 DOM 時觸發一次，如果元素一開始是 `v-if="false"`，那切換為 `true` 時確實會觸發。但如果用的是 `v-show`，元素一直存在於 DOM 中，`inserted` 不會再次觸發。

這種情況需要用 `update` 或 `componentUpdated`：

```javascript
Vue.directive('focus', {
  inserted(el, binding) {
    if (binding.value !== false) {
      el.focus()
    }
  },
  update(el, binding) {
    // 當 value 從 false 變為 true 時聚焦
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

## v-permission：按鈕權限控制

後台管理系統中最常見的需求：根據用户權限控制按鈕的顯示。有人用 `v-if`，但 `v-if` 需要在每個組件裏引入權限判斷邏輯，而指令可以做到全局統一。

```javascript
// directives/permission.js
import store from '@/store'

Vue.directive('permission', {
  inserted(el, binding) {
    const { value } = binding
    const permissions = store.getters.permissions // 用户權限列表

    if (value && value instanceof Array && value.length > 0) {
      const hasPermission = permissions.some(p => value.includes(p))

      if (!hasPermission) {
        // 方案一：直接移除元素
        el.parentNode && el.parentNode.removeChild(el)

        // 方案二：禁用而不是移除（某些場景更好）
        // el.disabled = true
        // el.classList.add('is-disabled')
        // el.title = '您沒有此操作權限'
      }
    } else {
      throw new Error('需要權限數組，如 v-permission="[\'user:add\']"')
    }
  }
})
```

使用方式：

```html
<template>
  <div>
    <button v-permission="['user:add']">新增用户</button>
    <button v-permission="['user:delete']">刪除用户</button>
    <button v-permission="['user:edit', 'user:add']">編輯用户</button>
  </div>
</template>
```

**踩過的坑：** 權限數據可能是異步加載的。如果在 `bind` 或 `inserted` 階段權限數據還沒請求回來，指令判斷就會出錯。解決方案有兩個：

方案一：在路由守衞中確保權限數據加載完成後再渲染頁面。

方案二：指令中監聽權限變化：

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

    // 立即檢查一次
    checkPermission()

    // 監聽權限變化（需要 Vuex store 支持）
    vnode.context.$watch(
      () => store.getters.permissions,
      () => checkPermission(),
      { deep: true }
    )
  }
})
```

## v-debounce：防抖指令

搜索輸入框的防抖控制，避免用户每輸入一個字符就發一次請求：

```javascript
Vue.directive('debounce', {
  bind(el, binding) {
    const delay = binding.arg || 300
    let timer = null

    el._debounceHandler = function(e) {
      if (timer) clearTimeout(timer)

      timer = setTimeout(() => {
        // 觸發原生 input 事件，讓 v-model 更新
        const event = new Event('input', { bubbles: true })
        el.dispatchEvent(event)

        // 如果傳了回調函數也執行
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

**踩過的坑：** 上面的實現有一個問題——在防抖期間，輸入框顯示的文字已經更新了（因為 v-model 是同步更新視圖的），但實際的 `keyword` 值還沒有更新。如果在防抖期間點擊提交按鈕，拿到的是舊值。

更嚴謹的做法是不依賴 `dispatchEvent`，而是直接操作 vnode 上的數據：

```javascript
Vue.directive('debounce', {
  bind(el, binding, vnode) {
    const delay = binding.arg || 300
    let timer = null

    el._debounceHandler = function(e) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        // 獲取 v-model 對應的表達式
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

## v-lazy-load：圖片懶加載

在沒有 `IntersectionObserver` 的場景下（或者需要兼容老瀏覽器），可以用指令實現圖片懶加載：

```javascript
Vue.directive('lazy-load', {
  bind(el, binding) {
    // 先用佔位圖替換真實地址
    el._lazySrc = binding.value
    el.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

    // 使用 IntersectionObserver（支持的話）
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
      // 降級方案：滾動監聽
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

**性能提醒：** 如果列表很長（幾百張圖），用 `IntersectionObserver` 比滾動監聽性能好很多。滾動監聽每次都要計算 `getBoundingClientRect`，而 `IntersectionObserver` 是瀏覽器底層優化過的。

## 全局註冊 vs 局部註冊

實際項目中建議這樣組織：

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

這樣做的好處是所有指令統一管理，新增指令只需要在 `directives` 目錄加文件並導出即可。

## 小結

- 自定義指令適合需要**直接操作 DOM** 的場景，不要用來做組件該做的事
- 五個鈎子中 `bind` 和 `inserted` 最常用，注意 `v-show` 和 `v-if` 對觸發時機的影響
- `unbind` 鈎子一定要做清理（移除事件監聽、斷開 Observer），否則內存泄漏
- 權限指令要處理好異步數據加載的問題，不能假設數據在 `inserted` 時已就緒
- 防抖指令配合 `v-model` 使用時要注意數據同步的時機
- 全局指令建議用 `Vue.use()` 插件方式統一註冊，便於管理
