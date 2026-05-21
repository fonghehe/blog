---
title: "CSS BEM 命名規範實踐"
date: 2019-05-01 10:39:56
tags:
  - CSS
readingTime: 1
description: "在團隊推廣CSS BEM 命名規範實踐的過程中，踩了不少坑。整理出來希望對大家有所幫助。"
wordCount: 211
---

在團隊推廣CSS BEM 命名規範實踐的過程中，踩了不少坑。整理出來希望對大家有所幫助。

## 核心原理

核心程式碼如下：

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

實際專案中還需要考慮邊界條件和異常處理。

## 原始碼分析

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 實際應用

我們可以通過以下方式實現：

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

注意上面程式碼中的效能細節，避免不必要的計算。

## 小結

- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
- 遇到問題多看原始碼和官方文件
