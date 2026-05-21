---
title: "CSS Grid 與 Flexbox 互補佈局"
date: 2019-01-04 10:15:12
tags:
  - CSS
readingTime: 2
description: "CSS Grid 與 Flexbox 互補佈局是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。"
wordCount: 295
---

CSS Grid 與 Flexbox 互補佈局是日常開發中經常遇到的問題。本文從實際專案出發，分享具體的實現方法和經驗總結。

## 核心原理

先來看基本的用法：

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

這種寫法簡潔明瞭，適合大多數場景。

## 原始碼分析

核心程式碼如下：

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

實際專案中還需要考慮邊界條件和異常處理。

## 實際應用

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 最佳實踐

我們可以通過以下方式實現：

```css
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

注意上面程式碼中的效能細節，避免不必要的計算。

## 核心原理

具體實現參考以下程式碼：

```css
import React, { Component } from 'react'

class DataList extends Component {
  state = { items: [], loading: true }

  async componentDidMount() {
    const res = await fetch('/api/items')
    const items = await res.json()
    this.setState({ items, loading: false })
  }

  render() {
    const { items, loading } = this.state
    if (loading) return <div>載入中...</div>
    return (
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    )
  }
}
```

經過線上驗證，這套方案執行穩定。

## 小結

- CSS Grid 與 Flexbox 互補佈局的關鍵在於理解核心概念，不要停留在表面用法
- 實際專案中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
- 持續學習和總結，保持技術敏感度
