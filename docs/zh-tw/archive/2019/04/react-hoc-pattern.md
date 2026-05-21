---
title: "React 高階元件 HOC 模式"
date: 2019-04-09 10:45:08
tags:
  - React
readingTime: 1
description: "關於React 高階元件 HOC 模式，網上有不少文章但大多缺乏實戰經驗。本文結合真實專案，探討最佳實踐。"
wordCount: 198
---

關於React 高階元件 HOC 模式，網上有不少文章但大多缺乏實戰經驗。本文結合真實專案，探討最佳實踐。

## 基礎用法

下面是一個實際的例子：

```javascript
{% raw %}
<template>
  <div>
    <p>{{ message }}</p>
    <button @click="reverse">反轉</button>
  </div>
</template>

<script>
export default {
  data() {
    return { message: 'Hello Vue 2' }
  },
  methods: {
    reverse() {
      this.message = this.message.split('').reverse().join('')
    }
  }
}
</script>
{% endraw %}
```

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 進階技巧

我們可以通過以下方式實現：

```javascript
export default {
  props: ['items'],
  computed: {
    sorted() {
      return [...this.items].sort((a, b) => b.score - a.score)
    },
    count() {
      return this.items.length
    }
  },
  filters: {
    formatDate(val) {
      return new Date(val).toLocaleDateString('zh-CN')
    }
  }
}
```

注意上面程式碼中的效能細節，避免不必要的計算。

## 實戰案例

具體實現參考以下程式碼：

```javascript
export default {
  directives: {
    focus: {
      inserted(el) {
        el.focus()
      }
    },
    loading: {
      bind(el, binding) {
        if (binding.value) {
          el.classList.add('loading')
        }
      },
      update(el, binding) {
        el.classList.toggle('loading', binding.value)
      }
    }
  }
}
```

經過線上驗證，這套方案執行穩定。

## 小結

- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看原始碼和官方文件
