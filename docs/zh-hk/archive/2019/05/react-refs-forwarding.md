---
title: "React Refs 轉發與使用場景"
date: 2019-05-16 17:14:10
tags:
  - React
readingTime: 2
description: "最近項目中用到了React Refs 轉發與使用場景，發現比預想的要複雜。分享一下實踐過程中總結的經驗。"
---

最近項目中用到了React Refs 轉發與使用場景，發現比預想的要複雜。分享一下實踐過程中總結的經驗。

## 核心原理

具體實現參考以下代碼：

```javascript
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

經過線上驗證，這套方案運行穩定。

## 源碼分析

先來看基本的用法：

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

這種寫法簡潔明瞭，適合大多數場景。

## 實際應用

核心代碼如下：

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

實際項目中還需要考慮邊界條件和異常處理。

## 最佳實踐

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 核心原理

我們可以通過以下方式實現：

```javascript
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
    if (loading) return <div>加載中...</div>
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

注意上面代碼中的性能細節，避免不必要的計算。

## 小結

- 遇到問題多看源碼和官方文檔
- React Refs 轉發與使用場景的關鍵在於理解核心概念，不要停留在表面用法
- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
