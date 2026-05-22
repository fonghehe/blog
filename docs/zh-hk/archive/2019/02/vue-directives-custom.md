---
title: "Vue 2 自定義指令實戰：落地路徑與實戰建議"
date: 2019-02-27 17:05:59
tags:
  - Vue
readingTime: 1
description: "在團隊推廣Vue 2 自定義指令實戰的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
wordCount: 195
---

在團隊推廣Vue 2 自定義指令實戰的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 基礎用法

核心代碼如下：

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

實際項目中還需要考慮邊界條件和異常處理。

## 進階技巧

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 實戰案例

我們可以通過以下方式實現：

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

注意上面代碼中的性能細節，避免不必要的計算。

## 小結

- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
