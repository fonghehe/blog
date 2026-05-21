---
title: "CSS Flexbox 複雜佈局案例"
date: 2019-06-18 11:05:37
tags:
  - CSS
readingTime: 1
description: "關於CSS Flexbox 複雜佈局案例，網上有不少文章但大多缺乏實戰經驗。本文結合真實項目，探討最佳實踐。"
wordCount: 224
---

關於CSS Flexbox 複雜佈局案例，網上有不少文章但大多缺乏實戰經驗。本文結合真實項目，探討最佳實踐。

## 核心原理

下面是一個實際的例子：

```css
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sum 計算正確', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounce 延遲執行', () => {
    jest.useFakeTimers()
    const fn = jest.fn()
    const debounced = debounce(fn, 300)

    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 源碼分析

我們可以通過以下方式實現：

```css
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

注意上面代碼中的性能細節，避免不必要的計算。

## 實際應用

具體實現參考以下代碼：

```css
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

經過線上驗證，這套方案運行穩定。

## 小結

- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看源碼和官方文檔
- CSS Flexbox 複雜佈局案例的關鍵在於理解核心概念，不要停留在表面用法
